import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PubSub } from 'graphql-subscriptions';
import { PhoneValidationPipe } from 'src/common/pipes/phone-validation.pipe';
import { CustomerService } from 'src/modules/customer/customer.service';
import { Prisma } from 'src/generated/prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  CallCallbackStatusEnum,
  CallDirectionEnum,
  CallEventTypeEnum,
  CallPersonMatchStateEnum,
  CallRecordingSourceEnum,
  CallRecordingStateEnum,
  CallStatusEnum,
} from '../../enums/call.enums';

export type UisIngestResult = {
  processed: boolean;
  ignored?: string;
  callId?: string;
};

type UisIngestOptions = {
  skipSecurity?: boolean;
};

type PersonMatch = {
  personId: string | null;
  personMatchState: CallPersonMatchStateEnum;
};

const UIS_OPERATOR = 'uis';

@Injectable()
export class UisCallsWebhookService {
  private readonly phoneValidationPipe = new PhoneValidationPipe();

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly customerService: CustomerService,
    @Inject('CALLS_PUB_SUB') private readonly callsPubSub: PubSub,
  ) {}

  async ingestWebhook(
    payload: Record<string, unknown>,
    headers?: Record<string, string | string[] | undefined>,
    queryToken?: string,
    options?: UisIngestOptions,
  ): Promise<UisIngestResult> {
    if (!payload || typeof payload !== 'object') {
      return { processed: false, ignored: 'invalid_payload' };
    }
    const skipSecurity = options?.skipSecurity ?? false;

    const routingTokenRaw =
      queryToken ??
      this.getString(payload, ['webhook_token', 'webhookToken', 'token']);
    const routingToken =
      typeof routingTokenRaw === 'string' && routingTokenRaw.trim()
        ? routingTokenRaw.trim()
        : undefined;

    if (!skipSecurity) {
      const requireQueryToken = this.getBooleanConfig(
        'UIS_WEBHOOK_REQUIRE_QUERY_TOKEN',
        true,
      );
      if (requireQueryToken && !routingToken) {
        return { processed: false, ignored: 'missing_routing_token' };
      }

      if (!routingToken) {
        const sharedSecret = this.configService
          .get<string>('UIS_WEBHOOK_SHARED_SECRET')
          ?.trim();
        if (sharedSecret) {
          const secretHeaderName = (
            this.configService.get<string>('UIS_WEBHOOK_SECRET_HEADER') ??
            'x-uis-webhook-secret'
          )
            .trim()
            .toLowerCase();

          const providedSecret =
            this.getString(payload, ['webhook_secret', 'secret']) ??
            this.getHeaderValue(headers, [
              secretHeaderName,
              'x-uis-webhook-secret',
              'x-uis-signature',
            ]);

          if (!providedSecret || providedSecret !== sharedSecret) {
            return { processed: false, ignored: 'invalid_webhook_secret' };
          }
        }
      }
    }

    const providerCallSessionId = this.getString(payload, [
      'provider_call_session_id',
      'cdr_id',
      'call_session_id',
      'id',
    ]);
    if (!providerCallSessionId) {
      return { processed: false, ignored: 'missing_call_session_id' };
    }

    const lineExternalId = this.getString(payload, [
      'line_external_id',
      'line_id',
    ]);
    const virtualPhone = this.normalizePhone(
      this.getString(payload, [
        'virtual_phone_number',
        'virtual_phone',
        'numb',
        'called_phone_number',
      ]),
    );
    if (!lineExternalId && !virtualPhone) {
      return { processed: false, ignored: 'routing_key_missing' };
    }

    const bindingWhere: Prisma.CallRoutingBindingWhereInput = {
      operator: UIS_OPERATOR,
      isActive: true,
      OR: [
        ...(lineExternalId ? [{ lineExternalId }] : []),
        ...(virtualPhone ? [{ virtualPhone }] : []),
      ],
    };
    if (routingToken) {
      bindingWhere.webhookToken = routingToken;
    }

    const binding = await this.prisma.callRoutingBinding.findFirst({
      where: bindingWhere,
    });

    if (!binding) {
      return {
        processed: false,
        ignored: routingToken
          ? 'routing_or_token_not_found'
          : 'routing_not_found',
      };
    }

    const eventType = this.detectEventType(payload);
    const direction = this.detectDirection(payload);
    const status = this.detectStatus(payload, eventType);
    const isMissed = this.detectMissed(payload, eventType);
    const startedAt =
      this.parseDate(
        this.getString(payload, ['event_time', 'start_time', 'started_at']),
      ) ?? new Date();
    const answeredAt = this.parseDate(
      this.getString(payload, ['answer_time', 'answered_at']),
    );
    const endedAt = this.parseDate(
      this.getString(payload, ['finish_time', 'ended_at', 'completed_at']),
    );
    const durationSec = this.getNumber(payload, [
      'duration_sec',
      'total_duration',
      'talk_duration',
    ]);

    const callerPhone = this.normalizePhone(
      this.getString(payload, ['caller_phone', 'contact_phone_number', 'numa']),
    );
    const calleePhone = this.normalizePhone(
      this.getString(payload, [
        'callee_phone',
        'virtual_phone_number',
        'called_phone_number',
        'numb',
      ]),
    );
    const personPhone = this.detectPersonPhoneForMatch({
      direction,
      callerPhone,
      calleePhone,
      virtualPhone,
    });

    const personMatch = await this.matchPersonByPhone(
      binding.tenantGroupId,
      personPhone,
    );

    const providerCommunicationId = this.getString(payload, [
      'provider_communication_id',
      'communication_id',
    ]);
    const providerExternalId = this.getString(payload, [
      'provider_external_id',
      'external_id',
      'ext_id',
      'call_api_external_id',
    ]);

    const fileLink = this.getString(payload, [
      'file_link',
      'full_record_file_link',
    ]);
    const recordingProviderId = this.getFirstStringFromArray(payload, [
      'call_records',
      'wav_call_records',
    ]);
    const recordingSource = this.detectRecordingSource(
      fileLink,
      recordingProviderId,
    );
    const recordingState =
      recordingSource !== null
        ? CallRecordingStateEnum.PENDING
        : CallRecordingStateEnum.NONE;

    const eventAt =
      this.parseDate(this.getString(payload, ['event_time', 'created_at'])) ??
      new Date();
    const externalEventId = this.getString(payload, [
      'provider_event_id',
      'event_id',
    ]);

    const persisted = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.call.findUnique({
        where: {
          operator_providerCallSessionId: {
            operator: UIS_OPERATOR,
            providerCallSessionId,
          },
        },
      });

      const callRecord = existing
        ? await tx.call.update({
            where: { id: existing.id },
            data: {
              providerCommunicationId:
                existing.providerCommunicationId ?? providerCommunicationId,
              providerExternalId:
                existing.providerExternalId ?? providerExternalId,
              direction,
              status,
              startedAt: existing.startedAt ?? startedAt,
              answeredAt: existing.answeredAt ?? answeredAt,
              endedAt: endedAt ?? existing.endedAt,
              durationSec: durationSec ?? existing.durationSec,
              callerPhone: existing.callerPhone ?? callerPhone,
              calleePhone: existing.calleePhone ?? calleePhone,
              personId: existing.personId ?? personMatch.personId,
              personMatchState: existing.personId
                ? CallPersonMatchStateEnum.MATCHED
                : personMatch.personMatchState,
              isMissed: existing.isMissed || isMissed,
              recordingState:
                existing.recordingState === CallRecordingStateEnum.DOWNLOADED
                  ? CallRecordingStateEnum.DOWNLOADED
                  : recordingState,
              recordingSource: existing.recordingSource ?? recordingSource,
              recordingProviderId:
                existing.recordingProviderId ?? recordingProviderId,
              recordingLastProviderUrl:
                existing.recordingLastProviderUrl ?? fileLink,
              rawPayload: payload as Prisma.InputJsonValue,
            },
          })
        : await tx.call.create({
            data: {
              tenantId: binding.tenantId,
              tenantGroupId: binding.tenantGroupId,
              operator: UIS_OPERATOR,
              providerCallSessionId,
              providerCommunicationId,
              providerExternalId,
              direction,
              status,
              startedAt,
              answeredAt,
              endedAt,
              durationSec,
              callerPhone,
              calleePhone,
              personId: personMatch.personId,
              personMatchState: personMatch.personMatchState,
              isMissed,
              recordingState,
              recordingSource,
              recordingProviderId,
              recordingLastProviderUrl: fileLink,
              rawPayload: payload as Prisma.InputJsonValue,
            },
          });

      if (externalEventId) {
        const existingEvent = await tx.callEvent.findUnique({
          where: {
            operator_externalEventId: {
              operator: UIS_OPERATOR,
              externalEventId,
            },
          },
          select: { id: true },
        });
        if (!existingEvent) {
          await tx.callEvent.create({
            data: {
              callId: callRecord.id,
              tenantId: binding.tenantId,
              operator: UIS_OPERATOR,
              externalEventId,
              providerCallSessionId,
              eventType,
              eventAt,
              payload: payload as Prisma.InputJsonValue,
            },
          });
        }
      } else {
        await tx.callEvent.create({
          data: {
            callId: callRecord.id,
            tenantId: binding.tenantId,
            operator: UIS_OPERATOR,
            externalEventId: null,
            providerCallSessionId,
            eventType,
            eventAt,
            payload: payload as Prisma.InputJsonValue,
          },
        });
      }

      return callRecord;
    });

    await this.autoMarkPreviousMissedAsCalledBack({
      tenantId: binding.tenantId,
      currentCall: {
        id: persisted.id,
        direction: persisted.direction,
        status,
        isMissed,
        startedAt: persisted.startedAt,
        callerPhone: persisted.callerPhone,
        calleePhone: persisted.calleePhone,
        virtualPhone: virtualPhone ?? binding.virtualPhone ?? null,
      },
    });

    await this.publishRealtimeEvents({
      persisted,
      tenantId: binding.tenantId,
      eventType,
      isMissed,
      payload,
    });

    return {
      processed: true,
      callId: persisted.id,
    };
  }

  async ingestPollingPayload(
    payload: Record<string, unknown>,
  ): Promise<UisIngestResult> {
    return this.ingestWebhook(payload, undefined, undefined, {
      skipSecurity: true,
    });
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

  private detectDirection(payload: Record<string, unknown>): CallDirectionEnum {
    const raw = this.getString(payload, [
      'direction',
      'call_direction',
    ])?.toLowerCase();
    if (raw === 'out' || raw?.includes('out')) {
      return CallDirectionEnum.OUTBOUND;
    }
    return CallDirectionEnum.INBOUND;
  }

  private detectStatus(
    payload: Record<string, unknown>,
    eventType: CallEventTypeEnum,
  ): CallStatusEnum {
    if (eventType === CallEventTypeEnum.MISSED) return CallStatusEnum.MISSED;
    if (eventType === CallEventTypeEnum.ANSWERED)
      return CallStatusEnum.ANSWERED;
    if (
      eventType === CallEventTypeEnum.COMPLETED ||
      eventType === CallEventTypeEnum.RECORDING_READY
    ) {
      return CallStatusEnum.COMPLETED;
    }

    const raw = this.getString(payload, [
      'status',
      'call_status',
      'state',
      'finish_reason',
    ])
      ?.toLowerCase()
      .trim();

    if (!raw) return CallStatusEnum.RINGING;
    if (raw.includes('miss') || raw.includes('lost'))
      return CallStatusEnum.MISSED;
    if (raw.includes('answer') || raw.includes('talk'))
      return CallStatusEnum.ANSWERED;
    if (
      raw.includes('complete') ||
      raw.includes('done') ||
      raw.includes('finish')
    ) {
      return CallStatusEnum.COMPLETED;
    }
    if (raw.includes('fail') || raw.includes('error'))
      return CallStatusEnum.FAILED;

    return CallStatusEnum.RINGING;
  }

  private detectMissed(
    payload: Record<string, unknown>,
    eventType: CallEventTypeEnum,
  ): boolean {
    if (eventType === CallEventTypeEnum.MISSED) return true;
    const raw = payload['is_lost'];
    if (typeof raw === 'boolean') return raw;
    if (typeof raw === 'string')
      return ['true', '1', 'yes'].includes(raw.toLowerCase());
    if (typeof raw === 'number') return raw === 1;
    return false;
  }

  private detectEventType(payload: Record<string, unknown>): CallEventTypeEnum {
    const raw = this.getString(payload, [
      'provider_event_type',
      'event_type',
      'event',
      'type',
    ])
      ?.toLowerCase()
      .trim();

    if (!raw) {
      return CallEventTypeEnum.CREATED;
    }
    if (raw.includes('record')) return CallEventTypeEnum.RECORDING_READY;
    if (raw.includes('miss') || raw.includes('lost'))
      return CallEventTypeEnum.MISSED;
    if (raw.includes('answer') || raw.includes('pickup')) {
      return CallEventTypeEnum.ANSWERED;
    }
    if (
      raw.includes('finish') ||
      raw.includes('complete') ||
      raw.includes('end')
    ) {
      return CallEventTypeEnum.COMPLETED;
    }
    if (
      raw.includes('ring') ||
      raw.includes('start') ||
      raw.includes('incoming')
    ) {
      return CallEventTypeEnum.RINGING;
    }
    return CallEventTypeEnum.CREATED;
  }

  private detectRecordingSource(
    fileLink: string | undefined,
    recordId: string | undefined,
  ): CallRecordingSourceEnum | null {
    if (fileLink) return CallRecordingSourceEnum.WEBHOOK_FILE_LINK;
    if (recordId) return CallRecordingSourceEnum.DATA_API_CALL_RECORDS;
    return null;
  }

  private async autoMarkPreviousMissedAsCalledBack(params: {
    tenantId: string;
    currentCall: {
      id: string;
      direction: CallDirectionEnum;
      status: CallStatusEnum;
      isMissed: boolean;
      startedAt: Date;
      callerPhone: string | null;
      calleePhone: string | null;
      virtualPhone: string | null;
    };
  }): Promise<void> {
    if (!this.canResolvePreviousMissedWithCurrentCall(params.currentCall)) {
      return;
    }

    const personPhone = this.detectPersonPhoneForMatch({
      direction: params.currentCall.direction,
      callerPhone: params.currentCall.callerPhone ?? undefined,
      calleePhone: params.currentCall.calleePhone ?? undefined,
      virtualPhone: params.currentCall.virtualPhone ?? undefined,
    });
    if (!personPhone) {
      return;
    }

    await this.prisma.call.updateMany({
      where: {
        tenantId: params.tenantId,
        isMissed: true,
        callbackStatus: CallCallbackStatusEnum.NOT_SET,
        id: { not: params.currentCall.id },
        startedAt: { lt: params.currentCall.startedAt },
        OR: [{ callerPhone: personPhone }, { calleePhone: personPhone }],
      },
      data: {
        callbackStatus: CallCallbackStatusEnum.CALLED_BACK,
        callbackMarkedAt: params.currentCall.startedAt,
        callbackMarkedByUserId: null,
      },
    });
  }

  private canResolvePreviousMissedWithCurrentCall(currentCall: {
    direction: CallDirectionEnum;
    status: CallStatusEnum;
    isMissed: boolean;
  }): boolean {
    if (currentCall.isMissed || currentCall.status === CallStatusEnum.MISSED) {
      return false;
    }

    if (currentCall.direction === CallDirectionEnum.OUTBOUND) {
      return (
        currentCall.status === CallStatusEnum.ANSWERED ||
        currentCall.status === CallStatusEnum.COMPLETED
      );
    }

    return (
      currentCall.status === CallStatusEnum.ANSWERED ||
      currentCall.status === CallStatusEnum.COMPLETED
    );
  }

  private async publishRealtimeEvents(params: {
    persisted: {
      id: string;
      tenantGroupId: string;
      operator: string;
      providerCallSessionId: string;
      providerCommunicationId: string | null;
      providerExternalId: string | null;
      direction: CallDirectionEnum;
      status: CallStatusEnum;
      startedAt: Date;
      answeredAt: Date | null;
      endedAt: Date | null;
      durationSec: number | null;
      callerPhone: string | null;
      calleePhone: string | null;
      personId: string | null;
      personMatchState: CallPersonMatchStateEnum;
      isMissed: boolean;
      callbackStatus: string;
      callbackMarkedAt: Date | null;
      callbackMarkedByUserId: string | null;
      recordingState: string;
      recordingPath: string | null;
      recordingAvailableUntil: Date | null;
      createdAt: Date | null;
    };
    tenantId: string;
    eventType: CallEventTypeEnum;
    isMissed: boolean;
    payload: Record<string, unknown>;
  }): Promise<void> {
    if (this.isPollingPayload(params.payload)) {
      return;
    }

    const virtualPhone = this.normalizePhone(
      this.getString(params.payload, [
        'virtual_phone_number',
        'virtual_phone',
        'numb',
        'called_phone_number',
      ]),
    );
    const personPhone = this.detectPersonPhoneForMatch({
      direction: params.persisted.direction,
      callerPhone: params.persisted.callerPhone ?? undefined,
      calleePhone: params.persisted.calleePhone ?? undefined,
      virtualPhone,
    });

    const personFullName = await this.resolveCustomerDisplayName({
      tenantGroupId: params.persisted.tenantGroupId,
      personId: params.persisted.personId,
      phone: personPhone,
    });
    const subscriptionCall = {
      ...params.persisted,
      personFullName,
    };
    const publishTasks: Array<Promise<void>> = [];

    const shouldPublishIncoming =
      params.persisted.direction === CallDirectionEnum.INBOUND &&
      (params.eventType === CallEventTypeEnum.CREATED ||
        params.eventType === CallEventTypeEnum.RINGING);
    if (shouldPublishIncoming) {
      publishTasks.push(
        this.callsPubSub.publish(`CALL_INCOMING_${params.tenantId}`, {
          incomingCall: subscriptionCall,
        }),
      );
    }

    const shouldPublishMissed =
      params.isMissed ||
      params.eventType === CallEventTypeEnum.MISSED ||
      params.persisted.status === CallStatusEnum.MISSED;
    if (shouldPublishMissed) {
      publishTasks.push(
        this.callsPubSub.publish(`CALL_MISSED_${params.tenantId}`, {
          missedCall: subscriptionCall,
        }),
      );
    }

    if (publishTasks.length === 0) {
      return;
    }

    await Promise.all(publishTasks).catch(() => {
      // Realtime publish errors should not break ingestion.
    });
  }

  private async resolveCustomerDisplayName(params: {
    tenantGroupId: string;
    personId: string | null;
    phone: string | undefined;
  }): Promise<string | null> {
    return this.customerService.resolveCustomerDisplayName(params);
  }

  private isPollingPayload(payload: Record<string, unknown>): boolean {
    const source = this.getString(payload, ['source']);
    return source?.toLowerCase() === 'uis_polling';
  }

  private detectPersonPhoneForMatch(params: {
    direction: CallDirectionEnum;
    callerPhone: string | undefined;
    calleePhone: string | undefined;
    virtualPhone: string | undefined;
  }): string | undefined {
    const { direction, callerPhone, calleePhone, virtualPhone } = params;

    if (direction === CallDirectionEnum.OUTBOUND) {
      if (calleePhone && calleePhone !== virtualPhone) return calleePhone;
      if (callerPhone && callerPhone !== virtualPhone) return callerPhone;
      return calleePhone ?? callerPhone;
    }

    if (callerPhone && callerPhone !== virtualPhone) return callerPhone;
    if (calleePhone && calleePhone !== virtualPhone) return calleePhone;
    return callerPhone ?? calleePhone;
  }

  private async matchPersonByPhone(
    tenantGroupId: string,
    phone: string | undefined,
  ): Promise<PersonMatch> {
    const match = await this.customerService.resolvePersonMatchByPhone(
      tenantGroupId,
      phone,
    );

    return {
      personId: match.personId,
      personMatchState: this.mapPersonMatchState(match.state),
    };
  }

  private mapPersonMatchState(
    state: 'MATCHED' | 'AMBIGUOUS' | 'NOT_FOUND',
  ): CallPersonMatchStateEnum {
    if (state === 'MATCHED') {
      return CallPersonMatchStateEnum.MATCHED;
    }
    if (state === 'AMBIGUOUS') {
      return CallPersonMatchStateEnum.AMBIGUOUS;
    }
    return CallPersonMatchStateEnum.NOT_FOUND;
  }

  private getString(
    payload: Record<string, unknown>,
    keys: string[],
  ): string | undefined {
    for (const key of keys) {
      const value = payload[key];
      if (typeof value === 'string' && value.trim()) {
        return value.trim();
      }
      if (typeof value === 'number') {
        return String(value);
      }
    }
    return undefined;
  }

  private getNumber(
    payload: Record<string, unknown>,
    keys: string[],
  ): number | undefined {
    for (const key of keys) {
      const value = payload[key];
      if (typeof value === 'number' && Number.isFinite(value)) {
        return Math.floor(value);
      }
      if (typeof value === 'string' && value.trim()) {
        const parsed = Number(value);
        if (Number.isFinite(parsed)) {
          return Math.floor(parsed);
        }
      }
    }
    return undefined;
  }

  private getHeaderValue(
    headers: Record<string, string | string[] | undefined> | undefined,
    names: string[],
  ): string | undefined {
    if (!headers) return undefined;
    for (const name of names) {
      const raw = headers[name];
      if (typeof raw === 'string' && raw.trim()) {
        return raw.trim();
      }
      if (Array.isArray(raw) && typeof raw[0] === 'string' && raw[0].trim()) {
        return raw[0].trim();
      }
    }
    return undefined;
  }

  private getFirstStringFromArray(
    payload: Record<string, unknown>,
    keys: string[],
  ): string | undefined {
    for (const key of keys) {
      const value = payload[key];
      if (Array.isArray(value) && value.length > 0) {
        const first: unknown = value[0];
        if (typeof first === 'string' && first.trim()) {
          return first.trim();
        }
      }
    }
    return undefined;
  }

  private parseDate(value?: string): Date | undefined {
    if (!value) return undefined;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return undefined;
    return date;
  }

  private normalizePhone(value?: string): string | undefined {
    if (!value) return undefined;
    try {
      return this.phoneValidationPipe.transform(value);
    } catch {
      return undefined;
    }
  }
}
