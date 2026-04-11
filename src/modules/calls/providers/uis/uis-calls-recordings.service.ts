import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, extname, join, resolve } from 'node:path';
import { PrismaService } from 'src/prisma/prisma.service';
import { CallRecordingStateEnum } from '../../enums/call.enums';

const UIS_RECORDINGS_CRON = '*/1 * * * *';

type PendingRecording = {
  id: string;
  tenantId: string;
  startedAt: Date;
  recordingLastProviderUrl: string;
};

type PendingRecordingRow = {
  id: string;
  tenantId: string;
  startedAt: Date;
  recordingLastProviderUrl: string | null;
};

@Injectable()
export class UisCallsRecordingsService {
  private readonly logger = new Logger(UisCallsRecordingsService.name);
  private isRunning = false;
  private runningSinceMs: number | null = null;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  @Cron(UIS_RECORDINGS_CRON)
  async downloadPendingRecordingsByCron(): Promise<void> {
    const enabled = this.getBooleanConfig(
      'UIS_RECORDINGS_DOWNLOAD_ENABLED',
      false,
    );
    if (!enabled) {
      return;
    }

    if (this.isRunning) {
      const runningForMs = this.runningSinceMs
        ? Date.now() - this.runningSinceMs
        : null;
      this.logger.warn(
        `Skip UIS recordings run: previous run still active${runningForMs !== null ? ` (${runningForMs}ms)` : ''}`,
      );
      return;
    }

    this.isRunning = true;
    this.runningSinceMs = Date.now();
    try {
      await this.downloadPendingRecordingsOnce();
    } catch (error) {
      this.logger.error(
        `UIS recordings downloader failed: ${this.formatError(error)}`,
      );
    } finally {
      this.isRunning = false;
      this.runningSinceMs = null;
    }
  }

  async downloadPendingRecordingsOnce(): Promise<void> {
    const batchLimit = this.getIntConfig(
      'UIS_RECORDINGS_DOWNLOAD_BATCH_LIMIT',
      10,
      1,
      200,
    );
    const pending = await this.prisma.call.findMany({
      where: {
        operator: 'uis',
        recordingState: CallRecordingStateEnum.PENDING,
        recordingPath: null,
        recordingLastProviderUrl: { not: null },
      },
      select: {
        id: true,
        tenantId: true,
        startedAt: true,
        recordingLastProviderUrl: true,
      },
      orderBy: { startedAt: 'asc' },
      take: batchLimit,
    });

    if (pending.length === 0) {
      return;
    }

    let downloaded = 0;
    let failed = 0;

    for (const call of pending) {
      const recording = this.toPendingRecording(call);
      if (!recording) {
        continue;
      }

      const success = await this.downloadSingleRecording(recording);
      if (success) {
        downloaded += 1;
      } else {
        failed += 1;
      }
    }

    this.logger.log(
      `UIS recordings downloader done: downloaded=${downloaded}, failed=${failed}, selected=${pending.length}`,
    );
  }

  private toPendingRecording(
    call: PendingRecordingRow,
  ): PendingRecording | null {
    if (!call.recordingLastProviderUrl) {
      return null;
    }

    return {
      id: call.id,
      tenantId: call.tenantId,
      startedAt: call.startedAt,
      recordingLastProviderUrl: call.recordingLastProviderUrl,
    };
  }

  private async downloadSingleRecording(
    call: PendingRecording,
  ): Promise<boolean> {
    const timeoutMs = this.getIntConfig(
      'UIS_RECORDINGS_DOWNLOAD_TIMEOUT_MS',
      30_000,
      1_000,
      300_000,
    );
    const retryCount = this.getIntConfig(
      'UIS_RECORDINGS_DOWNLOAD_RETRY_COUNT',
      2,
      0,
      10,
    );
    const retryDelayMs = this.getIntConfig(
      'UIS_RECORDINGS_DOWNLOAD_RETRY_DELAY_MS',
      1500,
      100,
      30_000,
    );

    for (let attempt = 0; attempt <= retryCount; attempt += 1) {
      try {
        const response = await this.fetchRecordingWithTimeout(
          call.recordingLastProviderUrl,
          timeoutMs,
        );

        if (!response.ok) {
          if (
            attempt < retryCount &&
            this.shouldRetryHttpStatus(response.status)
          ) {
            const delayMs = retryDelayMs * (attempt + 1);
            this.logger.warn(
              `Record download retry by HTTP status: callId=${call.id}, status=${response.status}, attempt=${attempt + 1}/${retryCount + 1}, delayMs=${delayMs}`,
            );
            await this.sleep(delayMs);
            continue;
          }

          await this.markFailed(call.id);
          this.logger.warn(
            `Record download HTTP ${response.status} for callId=${call.id}`,
          );
          return false;
        }

        const body = Buffer.from(await response.arrayBuffer());
        if (body.byteLength === 0) {
          await this.markFailed(call.id);
          this.logger.warn(
            `Record download returned empty body for callId=${call.id}`,
          );
          return false;
        }

        const contentType =
          response.headers.get('content-type')?.trim() ?? null;
        const extension = this.detectExtension(
          contentType,
          call.recordingLastProviderUrl,
        );
        const hash = createHash('sha256').update(body).digest('hex');

        const stored = await this.storeRecordingFile({
          callId: call.id,
          tenantId: call.tenantId,
          startedAt: call.startedAt,
          extension,
          body,
        });

        await this.prisma.call.update({
          where: { id: call.id },
          data: {
            recordingState: CallRecordingStateEnum.DOWNLOADED,
            recordingPath: stored.relativePath,
            recordingMime: contentType,
            recordingSize: BigInt(body.byteLength),
            recordingHash: hash,
          },
        });
        return true;
      } catch (error) {
        if (attempt < retryCount) {
          const delayMs = retryDelayMs * (attempt + 1);
          this.logger.warn(
            `Record download retry by network: callId=${call.id}, attempt=${attempt + 1}/${retryCount + 1}, delayMs=${delayMs}, error=${this.formatError(error)}`,
          );
          await this.sleep(delayMs);
          continue;
        }

        await this.markFailed(call.id);
        this.logger.warn(
          `Record download error for callId=${call.id}: ${this.formatError(error)}`,
        );
        return false;
      }
    }

    await this.markFailed(call.id);
    return false;
  }

  private async fetchRecordingWithTimeout(
    url: string,
    timeoutMs: number,
  ): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(url, {
        method: 'GET',
        signal: controller.signal,
      });
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`Record download timeout after ${timeoutMs}ms`);
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private async markFailed(callId: string): Promise<void> {
    await this.prisma.call.update({
      where: { id: callId },
      data: { recordingState: CallRecordingStateEnum.FAILED },
    });
  }

  private async storeRecordingFile(params: {
    callId: string;
    tenantId: string;
    startedAt: Date;
    extension: string;
    body: Buffer;
  }): Promise<{ relativePath: string }> {
    const baseDir =
      this.configService.get<string>('CALL_RECORDINGS_DIR')?.trim() ||
      'storage/call-recordings';
    const baseAbsolutePath = resolve(process.cwd(), baseDir);
    const year = String(params.startedAt.getUTCFullYear());
    const month = this.pad2(params.startedAt.getUTCMonth() + 1);
    const day = this.pad2(params.startedAt.getUTCDate());

    const relativeDir = join(params.tenantId, year, month, day);
    const filename = `${params.callId}${params.extension}`;
    const relativePath = this.toStoragePath(join(relativeDir, filename));
    const absolutePath = join(baseAbsolutePath, relativePath);

    await mkdir(dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, params.body);

    return {
      relativePath: this.toStoragePath(join(baseDir, relativePath)),
    };
  }

  private detectExtension(
    contentType: string | null,
    sourceUrl: string,
  ): string {
    const lowerType = contentType?.toLowerCase() ?? '';
    if (lowerType.includes('wav')) return '.wav';
    if (lowerType.includes('mpeg') || lowerType.includes('mp3')) return '.mp3';
    if (lowerType.includes('ogg')) return '.ogg';
    if (lowerType.includes('mp4') || lowerType.includes('aac')) return '.m4a';

    try {
      const parsed = new URL(sourceUrl);
      const ext = extname(parsed.pathname).toLowerCase();
      if (ext && ext.length <= 8) return ext;
    } catch {
      return '.bin';
    }
    return '.bin';
  }

  private toStoragePath(path: string): string {
    return path.replace(/\\/g, '/');
  }

  private pad2(value: number): string {
    return String(value).padStart(2, '0');
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

  private formatError(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }
    return String(error);
  }

  private shouldRetryHttpStatus(status: number): boolean {
    return status === 408 || status === 425 || status === 429 || status >= 500;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolvePromise) => {
      setTimeout(resolvePromise, ms);
    });
  }
}
