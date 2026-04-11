import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { stat } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { Prisma } from 'src/generated/prisma/client';
import { AppUserService } from 'src/modules/app-user/app-user.service';
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

export type CallRecordingFileInfo = {
  absolutePath: string;
  mime: string | null;
  filename: string;
  size: number;
};

@Injectable()
export class CallsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly appUserService: AppUserService,
  ) {}

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
    if (filter?.personId) {
      where.personId = filter.personId;
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

    const callbackUserIds = Array.from(
      new Set(
        items
          .map((item) => item.callbackMarkedByUserId)
          .filter((id): id is string => Boolean(id)),
      ),
    );
    const callbackUserNameById = new Map<string, string>();
    if (callbackUserIds.length > 0) {
      const callbackUsers =
        await this.appUserService.loadByIds(callbackUserIds);
      callbackUsers.forEach((user, id) => {
        callbackUserNameById.set(id, user.displayName);
      });
    }

    return {
      items: items.map((item) => this.toCallModel(item, callbackUserNameById)),
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

    const callbackUserNameById = new Map<string, string>();
    if (updated.callbackMarkedByUserId) {
      const callbackUsers = await this.appUserService.loadByIds([
        updated.callbackMarkedByUserId,
      ]);
      callbackUsers.forEach((user, id) => {
        callbackUserNameById.set(id, user.displayName);
      });
    }
    return this.toCallModel(updated, callbackUserNameById);
  }

  async getRecordingFile(
    ctx: AuthContext,
    callId: string,
  ): Promise<CallRecordingFileInfo> {
    const call = await this.prisma.call.findFirst({
      where: {
        id: callId,
        tenantId: ctx.tenantId,
      },
      select: {
        id: true,
        recordingPath: true,
        recordingMime: true,
      },
    });
    if (!call) {
      throw new NotFoundException('Звонок не найден');
    }
    if (!call.recordingPath) {
      throw new NotFoundException('Запись звонка не найдена');
    }

    const baseDir =
      this.configService.get<string>('CALL_RECORDINGS_DIR')?.trim() ||
      'storage/call-recordings';
    const baseAbsolutePath = resolve(process.cwd(), baseDir);
    const fileAbsolutePath = resolve(process.cwd(), call.recordingPath);

    if (!this.isPathWithin(baseAbsolutePath, fileAbsolutePath)) {
      throw new NotFoundException('Запись звонка не найдена');
    }

    const fileStats = await stat(fileAbsolutePath).catch(() => null);
    if (!fileStats?.isFile()) {
      throw new NotFoundException('Запись звонка не найдена');
    }

    const extension = extname(fileAbsolutePath) || '.bin';
    return {
      absolutePath: fileAbsolutePath,
      mime: call.recordingMime,
      filename: `call-${call.id}${extension}`,
      size: fileStats.size,
    };
  }

  private toCallModel(
    call: CallWithPerson,
    callbackUserNameById: Map<string, string> = new Map(),
  ): CallModel {
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
      callbackMarkedByUserName: call.callbackMarkedByUserId
        ? (callbackUserNameById.get(call.callbackMarkedByUserId) ?? null)
        : null,
      recordingState: call.recordingState,
      recordingPath: call.recordingPath,
      recordingAvailableUntil: call.recordingAvailableUntil,
      createdAt: call.createdAt,
    };
  }

  private isPathWithin(basePath: string, targetPath: string): boolean {
    if (targetPath === basePath) return true;
    return targetPath.startsWith(`${basePath}${sep}`);
  }
}
