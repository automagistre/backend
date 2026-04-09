import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from 'src/generated/prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import type { AuthContext } from 'src/common/user-id.store';
import { CallFilterInput } from './inputs/call-filter.input';
import { MarkCallCallbackInput } from './inputs/mark-call-callback.input';
import { CallCallbackStatusEnum } from './enums/call.enums';
import type { CallModel } from './models/call.model';

type CallWithPerson = Prisma.CallGetPayload<{
  include: {
    person: {
      select: {
        firstname: true;
        lastname: true;
      };
    };
  };
}>;

@Injectable()
export class CallsService {
  constructor(private readonly prisma: PrismaService) {}

  async listCalls(
    ctx: AuthContext,
    take = 25,
    skip = 0,
    filter?: CallFilterInput,
  ): Promise<{ items: CallModel[]; total: number }> {
    const where: Prisma.CallWhereInput = {
      tenantId: ctx.tenantId,
    };

    if (filter?.isMissed !== undefined) {
      where.isMissed = filter.isMissed;
    }
    if (filter?.status) {
      where.status = filter.status;
    }
    if (filter?.callbackStatus) {
      where.callbackStatus = filter.callbackStatus;
    }
    if (filter?.search?.trim()) {
      const q = filter.search.trim();
      where.OR = [
        { callerPhone: { contains: q } },
        { calleePhone: { contains: q } },
        { providerCallSessionId: { contains: q } },
        { providerCommunicationId: { contains: q } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.call.findMany({
        where,
        include: {
          person: {
            select: {
              firstname: true,
              lastname: true,
            },
          },
        },
        orderBy: { startedAt: 'desc' },
        take,
        skip,
      }),
      this.prisma.call.count({ where }),
    ]);

    return {
      items: items.map((item) => this.toCallModel(item)),
      total,
    };
  }

  async missedCallsCount(ctx: AuthContext): Promise<number> {
    return this.prisma.call.count({
      where: {
        tenantId: ctx.tenantId,
        isMissed: true,
        callbackStatus: CallCallbackStatusEnum.NOT_SET,
      },
    });
  }

  async markCallCallback(
    ctx: AuthContext,
    input: MarkCallCallbackInput,
  ): Promise<CallModel> {
    const existing = await this.prisma.call.findFirst({
      where: {
        id: input.callId,
        tenantId: ctx.tenantId,
      },
      include: {
        person: {
          select: {
            firstname: true,
            lastname: true,
          },
        },
      },
    });
    if (!existing) {
      throw new NotFoundException('Звонок не найден');
    }

    const updated = await this.prisma.call.update({
      where: { id: input.callId },
      data: {
        callbackStatus: CallCallbackStatusEnum.CALLED_BACK,
        callbackMarkedAt: new Date(),
        callbackMarkedByUserId: ctx.userId,
      },
      include: {
        person: {
          select: {
            firstname: true,
            lastname: true,
          },
        },
      },
    });

    return this.toCallModel(updated);
  }

  private toCallModel(call: CallWithPerson): CallModel {
    return {
      id: call.id,
      operator: call.operator,
      providerCallSessionId: call.providerCallSessionId,
      providerCommunicationId: call.providerCommunicationId,
      providerExternalId: call.providerExternalId,
      direction: call.direction,
      status: call.status,
      startedAt: call.startedAt,
      answeredAt: call.answeredAt,
      endedAt: call.endedAt,
      durationSec: call.durationSec,
      callerPhone: call.callerPhone,
      calleePhone: call.calleePhone,
      personId: call.personId,
      personFullName: call.person
        ? [call.person.firstname, call.person.lastname]
            .filter(Boolean)
            .join(' ')
            .trim() || null
        : null,
      personMatchState: call.personMatchState,
      isMissed: call.isMissed,
      callbackStatus: call.callbackStatus,
      callbackMarkedAt: call.callbackMarkedAt,
      callbackMarkedByUserId: call.callbackMarkedByUserId,
      recordingState: call.recordingState,
      recordingPath: call.recordingPath,
      recordingAvailableUntil: call.recordingAvailableUntil,
      createdAt: call.createdAt,
    };
  }
}
