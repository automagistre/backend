import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { addDays, startOfDay } from 'src/common/utils/zoned-time.util';
import { SettingsService } from 'src/modules/settings/settings.service';
import { calculateMotivation } from '../calculator/motivation-calculator';
import type {
  MotivationItemResult,
  MotivationItemType,
  MotivationScheme,
  MotivationStage,
} from '../calculator/motivation-calculator.types';
import { buildStartScheme } from '../calculator/start-scheme';
import { MotivationFactsService } from '../facts/motivation-facts.service';
import type {
  MotivationBacktestKeptModel,
  MotivationBacktestModel,
  MotivationBacktestOrderModel,
  MotivationBacktestTypeModel,
  MotivationOrderBreakdownModel,
} from '../models/motivation-backtest.model';
import {
  MotivationExclusionReasonEnum,
  MotivationItemTypeEnum,
  MotivationKeepReasonEnum,
  MotivationRowOutcomeEnum,
  MotivationStageEnum,
} from '../models/motivation.enums';

/** Стартовая схема ищет должности по названию; дальше веса правятся в форме. */
const START_POSITION_NAMES = {
  masterId: /мастер/i,
  adminId: /администратор/i,
  partsId: /запчаст/i,
};

type Names = {
  employees: Map<string, string>;
  positions: Map<string, string>;
};

@Injectable()
export class MotivationBacktestService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
    private readonly facts: MotivationFactsService,
  ) {}

  async defaultScheme(tenantId: string): Promise<MotivationScheme> {
    const positions = await this.prisma.staffPosition.findMany({
      where: { tenantId, archivedAt: null },
      select: { id: true, name: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
    const find = (pattern: RegExp) =>
      positions.find((position) => pattern.test(position.name))?.id ?? '';
    const scheme = buildStartScheme({
      masterId: find(START_POSITION_NAMES.masterId),
      adminId: find(START_POSITION_NAMES.adminId),
      partsId: find(START_POSITION_NAMES.partsId),
    });
    // Не нашлась должность — не оставляем в профиле пустой ключ
    for (const profile of Object.values(scheme.profiles)) {
      delete profile[''];
    }
    return scheme;
  }

  async backtest(
    tenantId: string,
    dateFrom: Date,
    dateTo: Date,
    scheme: MotivationScheme,
  ): Promise<MotivationBacktestModel> {
    const tz = await this.settings.getTimezone(tenantId);
    const from = startOfDay(dateFrom, tz);
    const toExclusive = addDays(startOfDay(dateTo, tz), 1);

    const [facts, names] = await Promise.all([
      this.facts.byPeriod(tenantId, from, toExclusive),
      this.loadNames(tenantId),
    ]);
    const results = calculateMotivation(facts.items, scheme);
    const itemById = new Map(facts.items.map((item) => [item.itemId, item]));

    const totals = {
      itemsCount: facts.items.length,
      ordersCount: 0,
      profit: 0n,
      fund: 0n,
      accrued: 0n,
      keptInFund: 0n,
      unattributed: 0n,
      excludedWarrantyCount: 0,
      excludedWarrantyProfit: 0n,
      excludedBeforeScheduleCount: 0,
      excludedBeforeScheduleProfit: 0n,
    };
    for (const excluded of facts.excluded) {
      if (excluded.reason === 'WARRANTY') {
        totals.excludedWarrantyCount++;
        totals.excludedWarrantyProfit += excluded.profitMinor;
      } else {
        totals.excludedBeforeScheduleCount++;
        totals.excludedBeforeScheduleProfit += excluded.profitMinor;
      }
    }

    const types = new Map<MotivationItemType, MotivationBacktestTypeModel>();
    const kept = new Map<string, MotivationBacktestKeptModel>();
    const keptItems = new Map<string, Set<string>>();
    const orders = new Map<
      string,
      MotivationBacktestOrderModel & { byEmployee: Map<string, bigint> }
    >();
    const employees = new Map<
      string,
      {
        amount: bigint;
        orders: Set<string>;
        stages: Map<MotivationStage, bigint>;
      }
    >();

    for (const result of results) {
      const item = itemById.get(result.itemId);
      if (!item) continue;
      const split = splitResult(result);
      totals.profit += result.profitMinor;
      totals.fund += result.fundMinor;
      totals.accrued += split.accrued;
      totals.keptInFund += split.kept;
      totals.unattributed += split.unattributed;

      const type = types.get(result.type) ?? {
        type: result.type as MotivationItemTypeEnum,
        itemsCount: 0,
        profit: 0n,
        fund: 0n,
        accrued: 0n,
        keptInFund: 0n,
        unattributed: 0n,
      };
      type.itemsCount++;
      type.profit += result.profitMinor;
      type.fund += result.fundMinor;
      type.accrued += split.accrued;
      type.keptInFund += split.kept;
      type.unattributed += split.unattributed;
      types.set(result.type, type);

      const order = orders.get(item.orderId) ?? {
        orderId: item.orderId,
        orderNumber: item.orderNumber,
        closedAt: item.closedAt,
        profit: 0n,
        fund: 0n,
        accrued: 0n,
        keptInFund: 0n,
        unattributed: 0n,
        employees: [],
        byEmployee: new Map<string, bigint>(),
      };
      order.profit += result.profitMinor;
      order.fund += result.fundMinor;
      order.accrued += split.accrued;
      order.keptInFund += split.kept;
      order.unattributed += split.unattributed;
      orders.set(item.orderId, order);

      for (const row of result.rows) {
        if (row.outcome === 'ACCRUED' && row.employeeId) {
          order.byEmployee.set(
            row.employeeId,
            (order.byEmployee.get(row.employeeId) ?? 0n) + row.amountMinor,
          );
          const employee = employees.get(row.employeeId) ?? {
            amount: 0n,
            orders: new Set<string>(),
            stages: new Map<MotivationStage, bigint>(),
          };
          employee.amount += row.amountMinor;
          employee.orders.add(item.orderId);
          if (row.stage) {
            employee.stages.set(
              row.stage,
              (employee.stages.get(row.stage) ?? 0n) + row.amountMinor,
            );
          }
          employees.set(row.employeeId, employee);
          continue;
        }
        const key = `${result.type}:${row.stage}:${row.outcome}:${row.reason}`;
        const bucket = kept.get(key) ?? {
          type: result.type as MotivationItemTypeEnum,
          stage: row.stage as MotivationStageEnum | null,
          outcome: row.outcome as MotivationRowOutcomeEnum,
          reason: row.reason as MotivationKeepReasonEnum | null,
          itemsCount: 0,
          amount: 0n,
        };
        const bucketItems = keptItems.get(key) ?? new Set<string>();
        bucketItems.add(result.itemId);
        keptItems.set(key, bucketItems);
        bucket.itemsCount = bucketItems.size;
        bucket.amount += row.amountMinor;
        kept.set(key, bucket);
      }
    }
    totals.ordersCount = orders.size;

    return {
      dateFrom,
      dateTo,
      totals,
      employees: [...employees]
        .map(([employeeId, employee]) => ({
          employeeId,
          employeeName: names.employees.get(employeeId) ?? 'Без имени',
          amount: employee.amount,
          ordersCount: employee.orders.size,
          stages: [...employee.stages].map(([stage, amount]) => ({
            stage: stage as MotivationStageEnum,
            amount,
          })),
        }))
        .sort((a, b) => compareDesc(a.amount, b.amount)),
      types: [...types.values()],
      kept: [...kept.values()].sort((a, b) => compareDesc(a.amount, b.amount)),
      orders: [...orders.values()]
        .map(({ byEmployee, ...order }) => ({
          ...order,
          employees: [...byEmployee]
            .map(([employeeId, amount]) => ({ employeeId, amount }))
            .sort((a, b) => compareDesc(a.amount, b.amount)),
        }))
        .sort((a, b) => b.closedAt.getTime() - a.closedAt.getTime()),
    };
  }

  async orderBreakdown(
    tenantId: string,
    orderId: string,
    scheme: MotivationScheme,
  ): Promise<MotivationOrderBreakdownModel> {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, tenantId },
      select: { id: true, number: true },
    });
    if (!order) throw new NotFoundException('Заказ не найден');

    const [facts, names] = await Promise.all([
      this.facts.byOrder(tenantId, orderId),
      this.loadNames(tenantId),
    ]);
    const labels = new Map(
      facts.items.map((item) => [item.itemId, item.label]),
    );
    const results = calculateMotivation(facts.items, scheme);

    return {
      orderId: order.id,
      orderNumber: order.number,
      items: results.map((result) => ({
        itemId: result.itemId,
        type: result.type as MotivationItemTypeEnum,
        label: labels.get(result.itemId) ?? '',
        profit: result.profitMinor,
        fund: result.fundMinor,
        rows: result.rows.map((row) => ({
          stage: row.stage as MotivationStageEnum | null,
          employeeId: row.employeeId,
          employeeName: row.employeeId
            ? (names.employees.get(row.employeeId) ?? 'Без имени')
            : null,
          positionId: row.positionId,
          positionName: row.positionId
            ? (names.positions.get(row.positionId) ?? null)
            : null,
          amount: row.amountMinor,
          outcome: row.outcome as MotivationRowOutcomeEnum,
          reason: row.reason as MotivationKeepReasonEnum | null,
          source: row.source,
        })),
      })),
      excluded: facts.excluded.map((item) => ({
        itemId: item.itemId,
        type: item.type as MotivationItemTypeEnum,
        label: item.label,
        profit: item.profitMinor,
        reason: item.reason as MotivationExclusionReasonEnum,
      })),
    };
  }

  private async loadNames(tenantId: string): Promise<Names> {
    const [employees, positions] = await Promise.all([
      this.prisma.employee.findMany({
        where: { tenantId },
        select: {
          id: true,
          person: { select: { lastname: true, firstname: true } },
        },
      }),
      this.prisma.staffPosition.findMany({
        where: { tenantId },
        select: { id: true, name: true },
      }),
    ]);
    return {
      employees: new Map(
        employees.map((employee) => [
          employee.id,
          [employee.person.lastname, employee.person.firstname]
            .filter(Boolean)
            .join(' ') || 'Без имени',
        ]),
      ),
      positions: new Map(
        positions.map((position) => [position.id, position.name]),
      ),
    };
  }
}

function splitResult(result: MotivationItemResult) {
  let accrued = 0n;
  let kept = 0n;
  let unattributed = 0n;
  for (const row of result.rows) {
    if (row.outcome === 'ACCRUED') accrued += row.amountMinor;
    else if (row.outcome === 'KEPT_IN_FUND') kept += row.amountMinor;
    else unattributed += row.amountMinor;
  }
  return { accrued, kept, unattributed };
}

function compareDesc(a: bigint, b: bigint): number {
  return a === b ? 0 : a > b ? -1 : 1;
}
