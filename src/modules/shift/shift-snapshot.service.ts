import { createHash, randomUUID } from 'crypto';
import { Injectable } from '@nestjs/common';
import type { Prisma } from 'src/generated/prisma/client';
import { resolveWorkDate } from 'src/common/utils/work-day.util';
import { SettingsService } from 'src/modules/settings/settings.service';
import { parseDateKey } from './shift.rules';
import { ShiftService } from './shift.service';

export type ShiftSnapshotPair = { employeeId: string; positionId: string };

/** Хэш не зависит от порядка пар: один состав — один снимок. */
export function shiftMembersHash(pairs: ShiftSnapshotPair[]): string {
  const keys = [
    ...new Set(pairs.map((pair) => `${pair.employeeId}:${pair.positionId}`)),
  ].sort();
  return createHash('sha256').update(keys.join(',')).digest('hex');
}

@Injectable()
export class ShiftSnapshotService {
  constructor(
    private readonly shifts: ShiftService,
    private readonly settings: SettingsService,
  ) {}

  /**
   * Фиксирует состав смены рабочего дня на момент `at` и возвращает id снимка.
   * Пустой состав — тоже снимок: «в смене никого не было» отличается от «снимка нет».
   */
  async capture(
    tx: Prisma.TransactionClient,
    tenantId: string,
    at: Date = new Date(),
  ): Promise<string> {
    const workDateKey = resolveWorkDate(
      at,
      await this.settings.getWorkDayHours(tenantId, tx),
    );
    const workDate = parseDateKey(workDateKey);
    const pairs = await this.shifts.findWorkingPairs(tenantId, workDateKey);
    const membersHash = shiftMembersHash(pairs);
    const where = {
      tenantId_workDate_membersHash: { tenantId, workDate, membersHash },
    };

    const existing = await tx.shiftSnapshot.findUnique({
      where,
      select: { id: true },
    });
    if (existing) return existing.id;

    // Две продажи одновременно при новом составе: вторая не падает на уникальности,
    // а дожидается первой и берёт её снимок.
    const id = randomUUID();
    const { count } = await tx.shiftSnapshot.createMany({
      data: [{ id, tenantId, workDate, membersHash, takenAt: at }],
      skipDuplicates: true,
    });
    if (count === 0) {
      const concurrent = await tx.shiftSnapshot.findUniqueOrThrow({
        where,
        select: { id: true },
      });
      return concurrent.id;
    }

    if (pairs.length) {
      await tx.shiftSnapshotMember.createMany({
        data: pairs.map((pair) => ({ snapshotId: id, ...pair })),
        skipDuplicates: true,
      });
    }
    return id;
  }
}
