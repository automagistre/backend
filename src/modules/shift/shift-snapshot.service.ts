import { createHash, randomUUID } from 'crypto';
import { Injectable } from '@nestjs/common';
import type { Prisma } from 'src/generated/prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { resolveWorkDate } from 'src/common/utils/work-day.util';
import { SettingsService } from 'src/modules/settings/settings.service';
import { ShiftSnapshotModel } from './models/shift-snapshot.model';
import { parseDateKey, toDateKey } from './shift.rules';
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
    private readonly prisma: PrismaService,
    private readonly shifts: ShiftService,
    private readonly settings: SettingsService,
  ) {}

  /**
   * Фиксирует состав смены рабочего дня на момент `at` и возвращает id снимка.
   * Пустой состав — тоже снимок: «в смене никого не было» отличается от «снимка нет».
   */
  async capture(
    db: Prisma.TransactionClient | PrismaService,
    tenantId: string,
    at: Date = new Date(),
  ): Promise<string> {
    const workDateKey = resolveWorkDate(
      at,
      await this.settings.getWorkDayHours(tenantId),
    );
    const workDate = parseDateKey(workDateKey);
    const pairs = await this.shifts.findWorkingPairs(tenantId, workDateKey);
    const membersHash = shiftMembersHash(pairs);
    const where = {
      tenantId_workDate_membersHash: { tenantId, workDate, membersHash },
    };

    const existing = await db.shiftSnapshot.findUnique({
      where,
      select: { id: true },
    });
    if (existing) return existing.id;

    // Снимок без участников переиспользовался бы как «пустая смена» — пишем вместе
    const insert = (tx: Prisma.TransactionClient) =>
      this.insert(tx, where, pairs, {
        tenantId,
        workDate,
        membersHash,
        takenAt: at,
      });
    return '$transaction' in db ? db.$transaction(insert) : insert(db);
  }

  async findOne(
    tenantId: string,
    id: string,
  ): Promise<ShiftSnapshotModel | null> {
    const snapshot = await this.prisma.shiftSnapshot.findFirst({
      where: { id, tenantId },
      include: {
        members: {
          include: { employee: { include: { person: true } }, position: true },
        },
      },
    });
    if (!snapshot) return null;

    const members = [...snapshot.members].sort(
      (a, b) =>
        a.position.sortOrder - b.position.sortOrder ||
        a.position.name.localeCompare(b.position.name, 'ru'),
    );
    return {
      id: snapshot.id,
      workDate: toDateKey(snapshot.workDate),
      takenAt: snapshot.takenAt,
      members: members.map((member) => ({
        employeeId: member.employeeId,
        personId: member.employee.personId,
        employeeName:
          [member.employee.person.lastname, member.employee.person.firstname]
            .filter(Boolean)
            .join(' ') || null,
        positionId: member.positionId,
        positionName: member.position.name,
      })),
    };
  }

  /**
   * Две продажи одновременно при новом составе: вторая не падает на уникальности,
   * а дожидается первой и берёт её снимок.
   */
  private async insert(
    tx: Prisma.TransactionClient,
    where: Prisma.ShiftSnapshotWhereUniqueInput,
    pairs: ShiftSnapshotPair[],
    data: Omit<Prisma.ShiftSnapshotCreateManyInput, 'id'>,
  ): Promise<string> {
    const id = randomUUID();
    const { count } = await tx.shiftSnapshot.createMany({
      data: [{ id, ...data }],
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
