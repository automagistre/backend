import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from 'src/prisma/prisma.service';
import { UisCallsWebhookService } from './uis-calls-webhook.service';

type UisReportRow = Record<string, unknown>;

type FetchCallsPageParams = {
  apiUrl: string;
  accessToken: string;
  from: Date;
  till: Date;
  limit: number;
  offset: number;
};

const UIS_POLLING_CRON = '*/1 * * * *';
const UIS_REPORT_FIELDS = [
  'id',
  'communication_id',
  'ext_id',
  'call_api_external_id',
  'start_time',
  'finish_time',
  'direction',
  'is_lost',
  'finish_reason',
  'contact_phone_number',
  'virtual_phone_number',
  'operator_phone_number',
  'wait_duration',
  'talk_duration',
  'clean_talk_duration',
  'total_duration',
  'postprocess_duration',
  'call_records',
  'wav_call_records',
  'full_record_file_link',
];

@Injectable()
export class UisCallsPollingService {
  private readonly logger = new Logger(UisCallsPollingService.name);
  private isRunning = false;
  private runningSinceMs: number | null = null;
  private lastSuccessfulTill: Date | null = null;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly uisCallsWebhookService: UisCallsWebhookService,
  ) {}

  @Cron(UIS_POLLING_CRON)
  async reconcileCallsReportByCron(): Promise<void> {
    const enabled = this.getBooleanConfig('UIS_POLLING_ENABLED', false);
    if (!enabled) {
      return;
    }

    if (this.isRunning) {
      const runningForMs = this.runningSinceMs
        ? Date.now() - this.runningSinceMs
        : null;
      this.logger.warn(
        `Skip UIS polling run: previous run still active${runningForMs !== null ? ` (${runningForMs}ms)` : ''}`,
      );
      return;
    }

    const runId = Date.now().toString(36);
    this.isRunning = true;
    this.runningSinceMs = Date.now();
    try {
      await this.reconcileOnce(runId);
    } catch (error) {
      this.logger.error(
        `UIS polling failed (runId=${runId}): ${this.formatError(error)}`,
      );
    } finally {
      this.isRunning = false;
      this.runningSinceMs = null;
    }
  }

  async reconcileOnce(runId = 'manual'): Promise<void> {
    const startedAtMs = Date.now();
    const apiUrl = this.configService.get<string>('UIS_DATA_API_URL')?.trim();
    const accessToken = this.configService
      .get<string>('UIS_DATA_API_ACCESS_TOKEN')
      ?.trim();

    if (!apiUrl || !accessToken) {
      this.logger.warn(
        'UIS polling is enabled, but UIS_DATA_API_URL or UIS_DATA_API_ACCESS_TOKEN is missing',
      );
      return;
    }

    const now = new Date();
    const from = await this.resolveDateFrom(now);
    const limit = this.getIntConfig('UIS_POLLING_PAGE_LIMIT', 200, 1, 1000);
    const maxPages = this.getIntConfig('UIS_POLLING_MAX_PAGES', 20, 1, 1000);

    let offset = 0;
    let pages = 0;
    let processed = 0;
    let ignored = 0;
    const ignoredReasons = new Map<string, number>();

    while (pages < maxPages) {
      const rows = await this.fetchCallsReportPage({
        apiUrl,
        accessToken,
        from,
        till: now,
        limit,
        offset,
      });
      if (rows.length === 0) {
        break;
      }

      pages += 1;
      for (const row of rows) {
        const payload = this.mapReportRowToWebhookPayload(row);
        const result =
          await this.uisCallsWebhookService.ingestPollingPayload(payload);
        if (result.processed) {
          processed += 1;
        } else {
          ignored += 1;
          const reason = result.ignored ?? 'unknown';
          ignoredReasons.set(reason, (ignoredReasons.get(reason) ?? 0) + 1);
        }
      }

      if (rows.length < limit) {
        break;
      }
      offset += limit;
    }

    this.lastSuccessfulTill = now;
    const elapsedMs = Date.now() - startedAtMs;
    const ignoredByReason =
      ignoredReasons.size > 0
        ? Array.from(ignoredReasons.entries())
            .map(([reason, count]) => `${reason}:${count}`)
            .join(',')
        : 'none';
    this.logger.log(
      `UIS polling done: runId=${runId}, elapsedMs=${elapsedMs}, processed=${processed}, ignored=${ignored}, ignoredByReason=${ignoredByReason}, pages=${pages}, from=${from.toISOString()}, till=${now.toISOString()}`,
    );
  }

  private async resolveDateFrom(now: Date): Promise<Date> {
    const lookbackMinutes = this.getIntConfig(
      'UIS_POLLING_LOOKBACK_MINUTES',
      180,
      1,
      60 * 24 * 14,
    );
    const overlapSeconds = this.getIntConfig(
      'UIS_POLLING_OVERLAP_SECONDS',
      120,
      0,
      60 * 60,
    );

    const minFrom = new Date(now.getTime() - lookbackMinutes * 60_000);

    const latestFromMemory = this.lastSuccessfulTill;
    let latestFromDb: Date | null = null;
    if (!latestFromMemory) {
      const latestCall = await this.prisma.call.findFirst({
        where: { operator: 'uis' },
        orderBy: { startedAt: 'desc' },
        select: { startedAt: true },
      });
      latestFromDb = latestCall?.startedAt ?? null;
    }

    const base = latestFromMemory ?? latestFromDb ?? minFrom;
    const boundedBase = base < minFrom ? minFrom : base;
    return new Date(boundedBase.getTime() - overlapSeconds * 1000);
  }

  private async fetchCallsReportPage(
    params: FetchCallsPageParams,
  ): Promise<UisReportRow[]> {
    const requestTimeoutMs = this.getIntConfig(
      'UIS_POLLING_REQUEST_TIMEOUT_MS',
      25_000,
      1_000,
      300_000,
    );
    const retryCount = this.getIntConfig(
      'UIS_POLLING_REQUEST_RETRY_COUNT',
      2,
      0,
      10,
    );
    const retryDelayMs = this.getIntConfig(
      'UIS_POLLING_REQUEST_RETRY_DELAY_MS',
      1200,
      100,
      30_000,
    );

    let attempt = 0;
    for (; attempt <= retryCount; attempt += 1) {
      try {
        const response = await this.fetchCallsReportPageOnce(
          params,
          requestTimeoutMs,
        );
        if (!response.ok) {
          const bodyText = await response.text();
          throw new Error(`UIS Data API HTTP ${response.status}: ${bodyText}`);
        }

        const json = (await response.json()) as Record<string, unknown>;
        const apiError = json['error'];
        if (apiError && typeof apiError === 'object') {
          const code = this.pickObjectNumber(apiError, ['code']);
          const message =
            this.pickObjectString(apiError, ['message']) ?? 'unknown';
          throw new Error(
            `UIS Data API RPC error${code !== undefined ? ` ${code}` : ''}: ${message}`,
          );
        }

        return this.extractRowsFromDataApiResponse(json);
      } catch (error) {
        if (attempt >= retryCount) {
          throw error;
        }
        const nextDelay = retryDelayMs * (attempt + 1);
        this.logger.warn(
          `UIS polling page retry: offset=${params.offset}, attempt=${attempt + 1}/${retryCount + 1}, delayMs=${nextDelay}, error=${this.formatError(error)}`,
        );
        await this.sleep(nextDelay);
      }
    }

    throw new Error('UIS polling retry loop failed unexpectedly');
  }

  private async fetchCallsReportPageOnce(
    params: FetchCallsPageParams,
    requestTimeoutMs: number,
  ): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, requestTimeoutMs);
    try {
      return await fetch(params.apiUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: `uis-polling-${params.offset}`,
          method: 'get.calls_report',
          params: {
            access_token: params.accessToken,
            date_from: this.toUisDateTime(params.from),
            date_till: this.toUisDateTime(params.till),
            limit: params.limit,
            offset: params.offset,
            fields: UIS_REPORT_FIELDS,
            include_ongoing_calls: true,
          },
        }),
      });
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(
          `UIS Data API request timeout after ${requestTimeoutMs}ms`,
        );
      }
      throw new Error(
        `UIS Data API request failed: ${this.formatError(error)}`,
      );
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private extractRowsFromDataApiResponse(
    json: Record<string, unknown>,
  ): UisReportRow[] {
    const candidates: unknown[] = [
      json['result'],
      (json['result'] as Record<string, unknown> | undefined)?.['data'],
      (json['result'] as Record<string, unknown> | undefined)?.['items'],
      (json['result'] as Record<string, unknown> | undefined)?.['records'],
      json['data'],
      json['items'],
      json['records'],
    ];

    for (const candidate of candidates) {
      if (Array.isArray(candidate)) {
        return candidate.filter((row): row is UisReportRow => {
          return typeof row === 'object' && row !== null;
        });
      }
    }
    return [];
  }

  private mapReportRowToWebhookPayload(
    row: UisReportRow,
  ): Record<string, unknown> {
    const providerCallSessionId = this.pickFirstString(row, [
      'id',
      'cdr_id',
      'call_session_id',
    ]);
    const startTime = this.pickFirstString(row, ['start_time']);
    const finishTime = this.pickFirstString(row, ['finish_time']);
    const direction = this.pickFirstString(row, ['direction']);
    const isLost = this.pickFirstBoolean(row, ['is_lost']);
    const eventType = isLost ? 'missed' : finishTime ? 'completed' : 'incoming';
    const eventTime = finishTime ?? startTime ?? new Date().toISOString();
    const eventId = this.buildPollingEventId(
      providerCallSessionId,
      eventType,
      eventTime,
    );

    return this.compactRecord({
      provider_call_session_id: providerCallSessionId,
      provider_event_id: eventId,
      provider_event_type: eventType,
      event_time: eventTime,
      start_time: startTime,
      finish_time: finishTime,
      direction,
      is_lost: isLost,
      total_duration: this.pickFirstNumber(row, [
        'total_duration',
        'talk_duration',
      ]),
      virtual_phone_number: this.pickFirstString(row, [
        'virtual_phone_number',
        'numb',
        'called_phone_number',
        'operator_phone_number',
      ]),
      contact_phone_number: this.pickFirstString(row, [
        'contact_phone_number',
        'numa',
        'calling_phone_number',
      ]),
      provider_communication_id: this.pickFirstString(row, [
        'communication_id',
      ]),
      provider_external_id: this.pickFirstString(row, [
        'ext_id',
        'external_id',
        'call_api_external_id',
      ]),
      full_record_file_link: this.pickFirstString(row, [
        'full_record_file_link',
      ]),
      call_records: this.pickFirstArray(row, ['call_records']),
      wav_call_records: this.pickFirstArray(row, ['wav_call_records']),
      source: 'uis_polling',
    });
  }

  private buildPollingEventId(
    sessionId: string | undefined,
    eventType: string,
    eventTime: string,
  ): string {
    return `poll:${sessionId ?? 'unknown'}:${eventType}:${eventTime}`;
  }

  private compactRecord(
    record: Record<string, unknown>,
  ): Record<string, unknown> {
    return Object.fromEntries(
      Object.entries(record).filter(([, value]) => value !== undefined),
    );
  }

  private pickFirstString(
    row: UisReportRow,
    keys: string[],
  ): string | undefined {
    for (const key of keys) {
      const value = row[key];
      if (typeof value === 'string' && value.trim()) return value.trim();
      if (typeof value === 'number') return String(value);
    }
    return undefined;
  }

  private pickFirstNumber(
    row: UisReportRow,
    keys: string[],
  ): number | undefined {
    for (const key of keys) {
      const value = row[key];
      if (typeof value === 'number' && Number.isFinite(value)) {
        return value;
      }
      if (typeof value === 'string' && value.trim()) {
        const parsed = Number(value);
        if (Number.isFinite(parsed)) return parsed;
      }
    }
    return undefined;
  }

  private pickFirstBoolean(
    row: UisReportRow,
    keys: string[],
  ): boolean | undefined {
    for (const key of keys) {
      const value = row[key];
      if (typeof value === 'boolean') return value;
      if (typeof value === 'number') return value === 1;
      if (typeof value === 'string') {
        const normalized = value.trim().toLowerCase();
        if (['true', '1', 'yes'].includes(normalized)) return true;
        if (['false', '0', 'no'].includes(normalized)) return false;
      }
    }
    return undefined;
  }

  private pickFirstArray(
    row: UisReportRow,
    keys: string[],
  ): unknown[] | undefined {
    for (const key of keys) {
      const value = row[key];
      if (Array.isArray(value)) {
        return value.map((item): unknown => item);
      }
    }
    return undefined;
  }

  private getBooleanConfig(key: string, defaultValue: boolean): boolean {
    const raw = this.configService.get<string | boolean>(key);
    if (typeof raw === 'boolean') return raw;
    if (typeof raw === 'string') {
      const normalized = raw.trim().toLowerCase();
      if (['true', '1', 'yes', 'y', 'on'].includes(normalized)) return true;
      if (['false', '0', 'no', 'n', 'off'].includes(normalized)) return false;
    }
    return defaultValue;
  }

  private getIntConfig(
    key: string,
    defaultValue: number,
    min: number,
    max: number,
  ): number {
    const raw = this.configService.get<string | number>(key);
    const value =
      typeof raw === 'number'
        ? raw
        : typeof raw === 'string'
          ? Number(raw)
          : defaultValue;

    if (!Number.isFinite(value)) return defaultValue;
    const intValue = Math.floor(value);
    if (intValue < min) return min;
    if (intValue > max) return max;
    return intValue;
  }

  private toUisDateTime(date: Date): string {
    const timezoneOffsetMinutes = this.getUisTimezoneOffsetMinutes();
    const shiftedDate = new Date(
      date.getTime() + timezoneOffsetMinutes * 60_000,
    );

    const year = shiftedDate.getUTCFullYear();
    const month = this.pad2(shiftedDate.getUTCMonth() + 1);
    const day = this.pad2(shiftedDate.getUTCDate());
    const hours = this.pad2(shiftedDate.getUTCHours());
    const minutes = this.pad2(shiftedDate.getUTCMinutes());
    const seconds = this.pad2(shiftedDate.getUTCSeconds());
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  }

  private getUisTimezoneOffsetMinutes(): number {
    const localOffsetMinutes = -new Date().getTimezoneOffset();
    const raw = this.configService.get<string | number>(
      'UIS_TIMEZONE_OFFSET_MINUTES',
    );
    const value =
      typeof raw === 'number'
        ? raw
        : typeof raw === 'string' && raw.trim()
          ? Number(raw)
          : localOffsetMinutes;
    if (!Number.isFinite(value)) {
      return localOffsetMinutes;
    }

    const rounded = Math.round(value);
    if (rounded < -720) return -720;
    if (rounded > 840) return 840;
    return rounded;
  }

  private pad2(value: number): string {
    return String(value).padStart(2, '0');
  }

  private pickObjectString(value: object, keys: string[]): string | undefined {
    const map = value as Record<string, unknown>;
    for (const key of keys) {
      const current = map[key];
      if (typeof current === 'string' && current.trim()) return current.trim();
    }
    return undefined;
  }

  private pickObjectNumber(value: object, keys: string[]): number | undefined {
    const map = value as Record<string, unknown>;
    for (const key of keys) {
      const current = map[key];
      if (typeof current === 'number' && Number.isFinite(current)) {
        return current;
      }
      if (typeof current === 'string' && current.trim()) {
        const parsed = Number(current);
        if (Number.isFinite(parsed)) return parsed;
      }
    }
    return undefined;
  }

  private formatError(error: unknown): string {
    if (error instanceof Error) {
      const withCause = error as Error & { cause?: unknown };
      if (withCause.cause === undefined) {
        return error.message;
      }
      if (withCause.cause instanceof Error) {
        return `${error.message}; cause=${withCause.cause.message}`;
      }
      if (typeof withCause.cause === 'object' && withCause.cause !== null) {
        return `${error.message}; cause=${JSON.stringify(withCause.cause)}`;
      }
      if (
        typeof withCause.cause === 'string' ||
        typeof withCause.cause === 'number' ||
        typeof withCause.cause === 'boolean' ||
        typeof withCause.cause === 'bigint'
      ) {
        return `${error.message}; cause=${withCause.cause}`;
      }
      if (typeof withCause.cause === 'symbol') {
        return `${error.message}; cause=${withCause.cause.toString()}`;
      }
      if (typeof withCause.cause === 'function') {
        return `${error.message}; cause=[function]`;
      }
      return `${error.message}; cause=[unknown]`;
    }

    return String(error);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolvePromise) => {
      setTimeout(resolvePromise, ms);
    });
  }
}
