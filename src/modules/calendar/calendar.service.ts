import { Injectable } from '@nestjs/common';
import { CalendarEntry, Prisma } from 'src/generated/prisma/client';
import { v6 as uuidv6 } from 'uuid';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  CreateCalendarEntryInput,
  DeletionReason,
  DeleteCalendarEntryInput,
  UpdateCalendarEntryInput,
} from './inputs/calendarEntry.input';
import type { AuthContext } from 'src/common/user-id.store';

const deletionReasonToDbValue: Record<DeletionReason, number> = {
  [DeletionReason.NO_REASON]: 1,
  [DeletionReason.PLAN_ANOTHER_TIME]: 2,
  [DeletionReason.NOT_HAVE_TIME_TO_ARRIVE]: 3,
  [DeletionReason.SOLVE_PROBLEM_WITHOUT_SERVICE]: 4,
  [DeletionReason.WE_ARE_CONDOMS]: 5,
};

const latestScheduleInclude = {
  orderBy: { id: 'desc' as const },
  take: 1,
};

const latestOrderInfoInclude = {
  orderBy: { id: 'desc' as const },
  take: 1,
};

const latestOrderInfoIncludeWithRelations = {
  ...latestOrderInfoInclude,
  include: {
    customer: true,
    car: true,
  },
};

type CalendarEntryWithLatest = Prisma.CalendarEntryGetPayload<{
  include: {
    calendarEntrySchedule: typeof latestScheduleInclude;
    calendarEntryOrderInfo: typeof latestOrderInfoInclude;
  };
}>;

const parseDurationToMinutes = (value: string | null | undefined): number => {
  if (!value) {
    return 0;
  }
  const raw = value.trim();
  if (!raw) {
    return 0;
  }
  const isoShort = raw.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/i);
  if (isoShort) {
    const hours = Number(isoShort[1] ?? 0);
    const minutes = Number(isoShort[2] ?? 0);
    const seconds = Number(isoShort[3] ?? 0);
    return hours * 60 + minutes + Math.round(seconds / 60);
  }
  const isoVerbose = raw.match(
    /^[+-]?P(?:\d+Y)?(?:\d+M)?(?:\d+D)?T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/i,
  );
  if (isoVerbose) {
    const hours = Number(isoVerbose[1] ?? 0);
    const minutes = Number(isoVerbose[2] ?? 0);
    const seconds = Number(isoVerbose[3] ?? 0);
    return hours * 60 + minutes + Math.round(seconds / 60);
  }
  return 0;
};

const minutesToIsoShort = (minutes: number): string => {
  const safe = Math.max(0, Math.floor(minutes));
  const hours = Math.floor(safe / 60);
  const mins = safe % 60;
  if (hours && mins) {
    return `PT${hours}H${mins}M`;
  }
  if (hours) {
    return `PT${hours}H`;
  }
  return `PT${mins}M`;
};

const normalizeLatestScheduleDuration = <
  T extends { calendarEntrySchedule?: Array<{ duration: string }> },
>(
  entry: T,
): T => {
  const schedule = entry.calendarEntrySchedule?.[0];
  if (!schedule) {
    return entry;
  }
  schedule.duration = minutesToIsoShort(parseDurationToMinutes(schedule.duration));
  return entry;
};

@Injectable()
export class CalendarService {
  constructor(private prisma: PrismaService) {}

  private async findEntryById(
    ctx: AuthContext,
    id: string,
  ): Promise<CalendarEntryWithLatest | null> {
    const { tenantId } = ctx;
    return this.prisma.calendarEntry.findFirst({
      where: { id, tenantId, calendarEntryDeletion: null },
      include: {
        calendarEntrySchedule: latestScheduleInclude,
        calendarEntryOrderInfo: latestOrderInfoInclude,
      },
    });
  }

  async getEntry(ctx: AuthContext, id: string): Promise<CalendarEntry | null> {
    const entry = await this.findEntryById(ctx, id);
    if (!entry) {
      return null;
    }
    return normalizeLatestScheduleDuration(entry);
  }

  async createEntry(
    ctx: AuthContext,
    data: CreateCalendarEntryInput,
  ): Promise<CalendarEntry> {
    const { tenantId, userId } = ctx;

    const { id } = await this.prisma.calendarEntry.create({
      data: {
        tenantId,
        createdBy: userId,
        calendarEntrySchedule: {
          create: {
            id: uuidv6(),
            tenantId,
            createdBy: userId,
            date: data.date,
            duration: data.duration,
          },
        },
        ...(data.customerId || data.carId || data.workerId || data.description
          ? {
              calendarEntryOrderInfo: {
                create: {
                  id: uuidv6(),
                  tenantId,
                  createdBy: userId,
                  customerId: data.customerId,
                  carId: data.carId,
                  workerId: data.workerId,
                  description: data.description,
                },
              },
            }
          : {}),
      },
    });

    return this.getEntry(ctx, id) as Promise<CalendarEntry>;
  }

  async updateEntry(
    ctx: AuthContext,
    { id: entryId, ...data }: UpdateCalendarEntryInput,
  ): Promise<CalendarEntry | null> {
    const { tenantId, userId } = ctx;
    const existing = await this.findEntryById(ctx, entryId);
    if (!existing) {
      return null;
    }

    const currentSchedule = existing.calendarEntrySchedule[0];
    const currentOrderInfo = existing.calendarEntryOrderInfo[0];
    const nextWorkerId =
      data.workerId !== undefined
        ? data.workerId
        : (currentOrderInfo?.workerId ?? null);
    const nextDescription =
      data.description !== undefined
        ? data.description
        : (currentOrderInfo?.description ?? null);
    const nextDate = data.date ?? currentSchedule?.date;
    const nextDuration = data.duration ?? currentSchedule?.duration;

    const shouldCreateOrderInfo =
      (data.workerId !== undefined || data.description !== undefined) &&
      (nextWorkerId !== (currentOrderInfo?.workerId ?? null) ||
        nextDescription !== (currentOrderInfo?.description ?? null));

    const shouldCreateSchedule =
      (data.date !== undefined || data.duration !== undefined) &&
      !!nextDate &&
      !!nextDuration &&
      (nextDate.getTime() !== currentSchedule?.date?.getTime() ||
        nextDuration !== currentSchedule?.duration);

    if (!shouldCreateOrderInfo && !shouldCreateSchedule) {
      return existing;
    }

    const tx: Prisma.PrismaPromise<unknown>[] = [];

    if (shouldCreateOrderInfo) {
      tx.push(this.prisma.calendarEntryOrderInfo.create({
        data: {
          id: uuidv6(),
          entryId,
          tenantId,
          createdBy: userId,
          workerId: nextWorkerId,
          description: nextDescription,
        },
      }));
    }

    if (shouldCreateSchedule && nextDate && nextDuration) {
      tx.push(this.prisma.calendarEntrySchedule.create({
        data: {
          id: uuidv6(),
          entryId,
          tenantId,
          createdBy: userId,
          date: nextDate,
          duration: nextDuration,
        },
      }));
    }

    if (tx.length) {
      await this.prisma.$transaction(tx);
    }

    return this.getEntry(ctx, entryId);
  }

  async deleteEntry(
    ctx: AuthContext,
    data: DeleteCalendarEntryInput,
  ): Promise<void> {
    const { tenantId, userId } = ctx;

    await this.prisma.calendarEntryDeletion.create({
      data: {
        entryId: data.id,
        tenantId,
        createdBy: userId,
        reason:
          deletionReasonToDbValue[data.reason] ??
          deletionReasonToDbValue[DeletionReason.NO_REASON],
        description: data.description,
      },
    });
  }

  async getEntriesByDate(ctx: AuthContext, date: Date) {
    const { tenantId } = ctx;

    // Используем UTC-границы, чтобы не ловить сдвиг дня из-за timezone сервера.
    const startOfDay = new Date(
      Date.UTC(
        date.getUTCFullYear(),
        date.getUTCMonth(),
        date.getUTCDate(),
        0,
        0,
        0,
        0,
      ),
    );
    const endOfDay = new Date(
      Date.UTC(
        date.getUTCFullYear(),
        date.getUTCMonth(),
        date.getUTCDate(),
        23,
        59,
        59,
        999,
      ),
    );

    const latestEntryIds = await this.prisma.$queryRaw<Array<{ id: string }>>(
      Prisma.sql`
        SELECT ce.id
        FROM calendar_entry ce
        JOIN LATERAL (
          SELECT s.date
          FROM calendar_entry_schedule s
          WHERE s.entry_id = ce.id
          ORDER BY s.id DESC
          LIMIT 1
        ) latest_schedule ON TRUE
        LEFT JOIN calendar_entry_deletion ced ON ced.entry_id = ce.id
        WHERE ce.tenant_id = ${tenantId}
          AND ced.id IS NULL
          AND latest_schedule.date >= ${startOfDay}
          AND latest_schedule.date <= ${endOfDay}
        ORDER BY latest_schedule.date ASC
      `,
    );
    const ids = latestEntryIds.map((item) => item.id);
    if (!ids.length) {
      return [];
    }

    const items = await this.prisma.calendarEntry.findMany({
      where: {
        tenantId,
        id: { in: ids },
        calendarEntryDeletion: null,
      },
      include: {
        calendarEntrySchedule: latestScheduleInclude,
        calendarEntryOrderInfo: latestOrderInfoIncludeWithRelations,
      },
    });

    const idsOrder = new Map(ids.map((id, index) => [id, index]));
    return items
      .map((item) => normalizeLatestScheduleDuration(item))
      .sort(
      (left, right) => (idsOrder.get(left.id) ?? 0) - (idsOrder.get(right.id) ?? 0),
      );
  }
}
