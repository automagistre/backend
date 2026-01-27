import { Injectable } from '@nestjs/common';
import { CalendarEntry, Prisma } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  CreateCalendarEntryInput,
  DeleteCalendarEntryInput,
  UpdateCalendarEntryInput,
} from './inputs/calendarEntry.input';

@Injectable()
export class CalendarService {
  constructor(private prisma: PrismaService) {}

  async getEntry(id: string): Promise<CalendarEntry | null> {
    const entry = await this.prisma.calendarEntry.findUnique({
      where: { id, calendarEntryDeletion: null },
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

  async createEntry(data: CreateCalendarEntryInput): Promise<CalendarEntry> {
    const entry: Prisma.CalendarEntryCreateInput = {
      calendarEntrySchedule: {
        create: {
          date: data.date,
          duration: data.duration,
        },
      },
    };

    if (data.customerId || data.carId || data.workerId || data.description) {
      entry.calendarEntryOrderInfo = {
        create: {
          customerId: data.customerId,
          carId: data.carId,
          workerId: data.workerId,
          description: data.description,
        },
      };
    }

    const { id } = await this.prisma.calendarEntry.create({
      data: entry,
    });

    return this.getEntry(id) as Promise<CalendarEntry>;
  }

  async updateEntry({
    id: entryId,
    ...data
  }: UpdateCalendarEntryInput): Promise<CalendarEntry | null> {
    if (data.workerId || data.description) {
      await this.prisma.calendarEntryOrderInfo.create({
        data: {
          entryId,
          workerId: data.workerId,
          description: data.description,
        },
      });
    }
    if (data.date || data.duration) {
      await this.prisma.calendarEntrySchedule.create({
        data: {
          entryId,
          date: data.date,
          duration: data.duration,
        },
      });
    }
    return this.getEntry(entryId);
  }

  async deleteEntry(data: DeleteCalendarEntryInput): Promise<void> {
    await this.prisma.calendarEntryDeletion.create({
      data: {
        entryId: data.id,
        reason: data.reason,
        description: data.description,
      },
    });
  }

  async getEntriesByDate(date: Date) {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    return this.prisma.calendarEntry.findMany({
      where: {
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
