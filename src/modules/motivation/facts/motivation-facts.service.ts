import { Injectable } from '@nestjs/common';
import type { Prisma } from 'src/generated/prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { resolveWorkDate } from 'src/common/utils/work-day.util';
import { addDays, dayKey } from 'src/common/utils/zoned-time.util';
import { SettingsService } from 'src/modules/settings/settings.service';
import { parseDateKey } from 'src/modules/shift/shift.rules';
import { ShiftService } from 'src/modules/shift/shift.service';
import { ProfitCostBasis } from 'src/modules/profit/enums/profit-cost-basis.enum';
import { ProfitLineKind } from 'src/modules/profit/enums/profit-line-kind.enum';
import type { MotivationParticipant } from '../calculator/motivation-calculator.types';
import { buildMotivationFacts } from './build-motivation-facts';
import {
  MOTIVATION_SCHEDULE_START,
  type MotivationEmployee,
  type MotivationFacts,
  type MotivationSourceRow,
} from './motivation-facts.types';

/** Не длиннее окна `ShiftService`: график читаем кусками. */
const SCHEDULE_CHUNK_DAYS = 300;

const PROFIT_SELECT = {
  id: true,
  orderItemId: true,
  storageId: true,
  orderId: true,
  kind: true,
  profitAmount: true,
  costBasis: true,
  warranty: true,
  closedAt: true,
  order: { select: { number: true } },
  orderItem: {
    select: {
      shiftSnapshotId: true,
      service: {
        select: {
          service: true,
          kind: true,
          executorKind: true,
          createdAt: true,
        },
      },
      part: {
        select: {
          createdAt: true,
          createdBy: true,
          part: { select: { name: true, number: true } },
          recommendationPart: {
            select: {
              createdAt: true,
              createdBy: true,
              recommendation: { select: { shiftSnapshotId: true } },
            },
          },
        },
      },
    },
  },
  storage: {
    select: { number: true, createdAt: true, shiftSnapshotId: true },
  },
} satisfies Prisma.OrderItemProfitSelect;

type ProfitRow = Prisma.OrderItemProfitGetPayload<{
  select: typeof PROFIT_SELECT;
}>;

type EmployeeRow = {
  id: string;
  personId: string;
  hiredAt: Date;
  firedAt: Date | null;
  positionIds: string[];
};

/**
 * Факты для калькулятора по закрытым сделкам: позиции из снапшота прибыли,
 * кто был в смене при их создании и кто подобрал запчасть.
 */
@Injectable()
export class MotivationFactsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly shifts: ShiftService,
    private readonly settings: SettingsService,
  ) {}

  byOrder(tenantId: string, orderId: string): Promise<MotivationFacts> {
    return this.collect(tenantId, { orderId });
  }

  /** Сделки, закрытые в [from, toExclusive). */
  byPeriod(
    tenantId: string,
    from: Date,
    toExclusive: Date,
  ): Promise<MotivationFacts> {
    return this.collect(tenantId, { closedAt: { gte: from, lt: toExclusive } });
  }

  private async collect(
    tenantId: string,
    where: Prisma.OrderItemProfitWhereInput,
  ): Promise<MotivationFacts> {
    const [profits, hours] = await Promise.all([
      this.prisma.orderItemProfit.findMany({
        where: { tenantId, ...where },
        select: PROFIT_SELECT,
        orderBy: [{ closedAt: 'asc' }, { id: 'asc' }],
      }),
      this.settings.getWorkDayHours(tenantId),
    ]);
    const serviceIds = profits.flatMap((profit) =>
      profit.orderItem?.service && profit.orderItemId
        ? [profit.orderItemId]
        : [],
    );
    const recommendations = serviceIds.length
      ? await this.prisma.carRecommendation.findMany({
          where: { realization: { in: serviceIds } },
          select: { realization: true, shiftSnapshotId: true },
        })
      : [];
    const recommendationByService = new Map(
      recommendations.map((rec) => [rec.realization, rec.shiftSnapshotId]),
    );

    const rows = profits.flatMap((profit) => {
      const row = this.toSourceRow(profit, recommendationByService);
      return row ? [row] : [];
    });
    const workDateOf = (at: Date) => resolveWorkDate(at, hours);

    const [snapshots, schedule, employeeOf] = await Promise.all([
      this.loadSnapshots(rows),
      this.loadSchedule(tenantId, rows, workDateOf),
      this.loadEmployees(tenantId, rows),
    ]);

    return buildMotivationFacts(rows, {
      workDateOf,
      snapshots,
      schedule,
      employeeOf,
    });
  }

  private toSourceRow(
    profit: ProfitRow,
    recommendationByService: Map<string | null, string | null>,
  ): MotivationSourceRow | null {
    const kind = profit.kind as ProfitLineKind;
    const costBasis = profit.costBasis as ProfitCostBasis;
    const base = {
      orderId: profit.orderId,
      orderNumber: profit.order.number,
      closedAt: profit.closedAt,
      profitMinor: profit.profitAmount,
      costBasis,
      warranty: profit.warranty,
    };
    const item = profit.orderItem;

    if (kind === ProfitLineKind.STORAGE && profit.storage) {
      return {
        ...base,
        itemId: profit.storageId ?? profit.id,
        kind: 'STORAGE',
        contractor: false,
        label: `Хранение шин №${profit.storage.number}`,
        anchor: {
          createdAt: profit.storage.createdAt,
          snapshotId: profit.storage.shiftSnapshotId,
        },
        recommendation: null,
        picker: null,
      };
    }

    if (kind === ProfitLineKind.SERVICE && item?.service) {
      const service = item.service;
      const realized = recommendationByService.has(profit.orderItemId);
      return {
        ...base,
        itemId: profit.orderItemId ?? profit.id,
        kind: 'SERVICE',
        contractor:
          costBasis === ProfitCostBasis.CONTRACTOR ||
          service.kind === 'CONTRACTOR' ||
          service.executorKind === 'ORGANIZATION',
        label: service.service,
        anchor: {
          createdAt: service.createdAt,
          snapshotId: item.shiftSnapshotId,
        },
        recommendation: realized
          ? {
              snapshotId:
                recommendationByService.get(profit.orderItemId) ?? null,
            }
          : null,
        picker: null,
      };
    }

    if (kind === ProfitLineKind.PART && item?.part) {
      const part = item.part;
      const fromRecommendation = part.recommendationPart;
      return {
        ...base,
        itemId: profit.orderItemId ?? profit.id,
        kind: 'PART',
        contractor: false,
        label: `${part.part.name} (${part.part.number})`,
        anchor: { createdAt: part.createdAt, snapshotId: item.shiftSnapshotId },
        recommendation: fromRecommendation
          ? { snapshotId: fromRecommendation.recommendation.shiftSnapshotId }
          : null,
        picker: fromRecommendation
          ? {
              userId: fromRecommendation.createdBy,
              at: fromRecommendation.createdAt,
              snapshotId: fromRecommendation.recommendation.shiftSnapshotId,
            }
          : {
              userId: part.createdBy,
              at: part.createdAt,
              snapshotId: item.shiftSnapshotId,
            },
      };
    }

    return null;
  }

  private async loadSnapshots(
    rows: MotivationSourceRow[],
  ): Promise<Map<string, MotivationParticipant[]>> {
    const ids = new Set<string>();
    for (const row of rows) {
      if (row.anchor.snapshotId) ids.add(row.anchor.snapshotId);
      if (row.recommendation?.snapshotId) {
        ids.add(row.recommendation.snapshotId);
      }
      if (row.picker?.snapshotId) ids.add(row.picker.snapshotId);
    }
    if (!ids.size) return new Map();

    const [snapshots, members] = await Promise.all([
      this.prisma.shiftSnapshot.findMany({
        where: { id: { in: [...ids] } },
        select: { id: true },
      }),
      this.prisma.shiftSnapshotMember.findMany({
        where: { snapshotId: { in: [...ids] } },
        select: { snapshotId: true, employeeId: true, positionId: true },
      }),
    ]);
    // Пустой снимок — тоже состав: «в смене никого»
    const bySnapshot = new Map<string, MotivationParticipant[]>(
      snapshots.map((snapshot) => [snapshot.id, []]),
    );
    for (const member of members) {
      bySnapshot.get(member.snapshotId)?.push({
        employeeId: member.employeeId,
        positionId: member.positionId,
      });
    }
    return bySnapshot;
  }

  /** График нужен только якорям без снимка и подборщикам без снимка. */
  private async loadSchedule(
    tenantId: string,
    rows: MotivationSourceRow[],
    workDateOf: (at: Date) => string,
  ): Promise<Map<string, MotivationParticipant[]>> {
    const dates = new Set<string>();
    const need = (at: Date | null, snapshotId: string | null) => {
      if (!at || snapshotId) return;
      const date = workDateOf(at);
      if (date >= MOTIVATION_SCHEDULE_START) dates.add(date);
    };
    for (const row of rows) {
      if (row.warranty) continue;
      need(row.anchor.createdAt, row.anchor.snapshotId);
      if (row.picker) need(row.picker.at, row.picker.snapshotId);
    }
    if (!dates.size) return new Map();

    const sorted = [...dates].sort();
    const schedule = new Map<string, MotivationParticipant[]>();
    let from = sorted[0];
    const last = sorted[sorted.length - 1];
    while (from <= last) {
      const chunkEnd = shiftDateKey(from, SCHEDULE_CHUNK_DAYS - 1);
      const to = chunkEnd < last ? chunkEnd : last;
      const chunk = await this.shifts.findWorkingPairsByDate(
        tenantId,
        from,
        to,
      );
      for (const [date, pairs] of chunk) {
        if (dates.has(date)) schedule.set(date, pairs);
      }
      from = shiftDateKey(to, 1);
    }
    return schedule;
  }

  private async loadEmployees(
    tenantId: string,
    rows: MotivationSourceRow[],
  ): Promise<(userId: string, at: Date) => MotivationEmployee | null> {
    const userIds = [
      ...new Set(rows.flatMap((row) => row.picker?.userId ?? [])),
    ];
    if (!userIds.length) return () => null;

    const users = await this.prisma.appUser.findMany({
      where: { id: { in: userIds }, personId: { not: null } },
      select: { id: true, personId: true },
    });
    const personIds = users.flatMap((user) => user.personId ?? []);
    const employees: EmployeeRow[] = personIds.length
      ? (
          await this.prisma.employee.findMany({
            where: { tenantId, personId: { in: personIds } },
            select: {
              id: true,
              personId: true,
              hiredAt: true,
              firedAt: true,
              staffPositions: { select: { positionId: true } },
            },
            orderBy: { hiredAt: 'desc' },
          })
        ).map((employee) => ({
          ...employee,
          positionIds: employee.staffPositions.map((link) => link.positionId),
        }))
      : [];

    const personByUser = new Map(users.map((user) => [user.id, user.personId]));
    return (userId, at) => {
      const personId = personByUser.get(userId);
      const candidates = employees.filter(
        (employee) => employee.personId === personId,
      );
      // Повторный найм: берём запись, действовавшую в момент подбора, иначе последнюю
      const employee =
        candidates.find(
          (candidate) =>
            candidate.hiredAt <= at &&
            (!candidate.firedAt || candidate.firedAt >= at),
        ) ?? candidates[0];
      return employee
        ? { employeeId: employee.id, positionIds: employee.positionIds }
        : null;
    };
  }
}

function shiftDateKey(dateKey: string, days: number): string {
  return dayKey(addDays(parseDateKey(dateKey), days));
}
