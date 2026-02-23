import { Injectable } from '@nestjs/common';
import { CalendarEntry, Prisma } from 'src/generated/prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  CreateCalendarEntryInput,
  DeleteCalendarEntryInput,
  UpdateCalendarEntryInput,
} from './inputs/calendarEntry.input';
import type { AuthContext } from 'src/common/user-id.store';

@Injectable()
export class CalendarService {
  constructor(private prisma: PrismaService) {}

  async getEntry(ctx: AuthContext, id: string): Promise<CalendarEntry | null> {
    const { tenantId } = ctx;
    const entry = await this.prisma.calendarEntry.findFirst({
      where: { id, tenantId, calendarEntryDeletion: null },
      include: {
        calendarEntrySchedule: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
        calendarEntryOrderInfo: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });
    return entry;
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

    if (data.workerId || data.description) {
      await this.prisma.calendarEntryOrderInfo.create({
        data: {
          entryId,
          tenantId,
          createdBy: userId,
          workerId: data.workerId,
          description: data.description,
        },
      });
    }
    if (data.date || data.duration) {
      await this.prisma.calendarEntrySchedule.create({
        data: {
          entryId,
          tenantId,
          createdBy: userId,
          date: data.date,
          duration: data.duration,
        },
      });
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
        reason: data.reason,
        description: data.description,
      },
    });
  }

  async getEntriesByDate(ctx: AuthContext, date: Date) {
    const { tenantId } = ctx;

    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    return this.prisma.calendarEntry.findMany({
      where: {
        tenantId,
        calendarEntrySchedule: {
          some: {
            date: {
              gte: startOfDay,
              lte: endOfDay,
            },
          },
        },
        calendarEntryDeletion: null,
      },
      include: {
        calendarEntrySchedule: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
        calendarEntryOrderInfo: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: {
            customer: true,
            car: true,
            worker: true,
          },
        },
      },
    });
  }
}
