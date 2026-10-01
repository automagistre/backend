import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from 'src/generated/prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import type { AuthContext } from 'src/common/user-id.store';
import { SettingsService } from 'src/modules/settings/settings.service';
import { CustomerTransactionService } from 'src/modules/customer-transaction/customer-transaction.service';
import { CustomerTransactionSource } from 'src/modules/customer-transaction/enums/customer-transaction-source.enum';
import { subtract, toMoney } from 'src/common/money';
import { ProfitService } from 'src/modules/profit/profit.service';
import { ProfitOrigin } from 'src/modules/profit/enums/profit-origin.enum';
import { TireStorageStatus } from 'src/modules/tire-storage/enums/tire-storage-status.enum';
import {
  calculateMotivation,
  motivationTotalsByEmployee,
} from '../calculator/motivation-calculator';
import type {
  MotivationCalculationOptions,
  MotivationItemResult,
  MotivationItemType,
  MotivationKeepReason,
  MotivationRowOutcome,
  MotivationSourceRef,
  MotivationStage,
} from '../calculator/motivation-calculator.types';
import { MotivationFactsService } from '../facts/motivation-facts.service';
import type { MotivationFacts } from '../facts/motivation-facts.types';
import {
  employeeName,
  loadMotivationNames,
  toBreakdownRow,
  toExcludedItem,
  type MotivationRowLike,
} from '../models/motivation-breakdown.mapper';
import {
  MotivationItemTypeEnum,
  OrderMotivationModeEnum,
} from '../models/motivation.enums';
import type { OrderMotivationModel } from '../models/order-motivation.model';
import { MotivationSchemeService } from '../scheme/motivation-scheme.service';

type OrderState = {
  id: string;
  number: number;
  /** null — заказ открыт. */
  closedAt: Date | null;
  cancelled: boolean;
};

type ItemView = {
  itemId: string;
  type: MotivationItemType;
  profitMinor: bigint;
  overheadMinor: bigint;
  rows: MotivationRowLike[];
};

@Injectable()
export class MotivationAccrualService {
  private readonly logger = new Logger(MotivationAccrualService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
    private readonly facts: MotivationFactsService,
    private readonly schemes: MotivationSchemeService,
    private readonly profit: ProfitService,
    private readonly customerTransactions: CustomerTransactionService,
  ) {}

  /**
   * Начисление по закрытой сделке: строки распределения и по проводке на сотрудника.
   * Повторный вызов ничего не делает. Схемы на дату закрытия нет — бонуса нет.
   */
  async chargeByOrder(ctx: AuthContext, orderId: string): Promise<void> {
    const order = await this.loadOrder(ctx.tenantId, orderId);
    if (!order.closedAt || order.cancelled) return;
    if (await this.isCharged(ctx.tenantId, orderId)) return;

    const stored = await this.schemes.activeAt(ctx.tenantId, order.closedAt);
    if (!stored) return;

    const [facts, kept, shares] = await Promise.all([
      this.facts.byOrder(ctx.tenantId, orderId),
      this.keptEmployees(ctx.tenantId),
      this.profit.overheadShares(this.prisma, ctx, orderId),
    ]);
    applyBonusOverhead(facts, shares);
    const results = calculateMotivation(facts.items, stored.scheme, kept);
    const rows = results.flatMap((result) =>
      result.rows.map((row) => ({ ...row, type: result.type })),
    );
    if (rows.length === 0) return;

    const totals = motivationTotalsByEmployee(results);
    const [employees, currencyCode] = await Promise.all([
      this.prisma.employee.findMany({
        where: { id: { in: [...totals.keys()] }, tenantId: ctx.tenantId },
        select: { id: true, personId: true },
      }),
      this.settings.getDefaultCurrencyCode(ctx.tenantId),
    ]);
    const personOf = new Map(employees.map((e) => [e.id, e.personId]));

    try {
      await this.prisma.$transaction(async (tx) => {
        const transactionOf = new Map<string, string>();
        for (const [employeeId, amountMinor] of totals) {
          const personId = personOf.get(employeeId);
          if (!personId || amountMinor <= 0n) continue;
          const created =
            await this.customerTransactions.createWithinTransaction(
              tx,
              {
                operandId: personId,
                source: CustomerTransactionSource.OrderMotivation,
                sourceId: orderId,
                description: `Бонус с продаж по заказу №${order.number}`,
                amount: { amountMinor, currencyCode },
              },
              ctx.tenantId,
              ctx.userId,
            );
          transactionOf.set(employeeId, created.id);
        }
        await tx.motivationAccrual.createMany({
          data: rows.map((row) => ({
            tenantId: ctx.tenantId,
            orderId,
            itemId: row.itemId,
            itemType: row.type,
            stage: row.stage,
            employeeId: row.employeeId,
            positionId: row.positionId,
            amountAmount: row.amountMinor,
            amountCurrencyCode: currencyCode,
            outcome: row.outcome,
            reason: row.reason,
            source: row.source,
            schemeId: stored.id,
            customerTransactionId:
              row.outcome === 'ACCRUED' && row.employeeId
                ? (transactionOf.get(row.employeeId) ?? null)
                : null,
          })),
        });
      });
    } catch (error) {
      // Параллельное закрытие и ручной повтор: второй упирается в уникальный индекс
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        this.logger.warn(`Бонус с продаж по заказу ${orderId} уже начислен`);
        return;
      }
      throw error;
    }
  }

  /**
   * Открытый заказ — прогноз тем же расчётом, что при закрытии, без записи.
   * Закрытый — сохранённые строки; без них — расчёт по схеме на дату закрытия.
   */
  async orderMotivation(
    ctx: AuthContext,
    orderId: string,
    previewWalletId?: string | null,
  ): Promise<OrderMotivationModel> {
    const order = await this.loadOrder(ctx.tenantId, orderId);
    const names = await loadMotivationNames(this.prisma, ctx.tenantId);

    if (!order.closedAt) {
      const now = new Date();
      const lines = await this.profit.computeOrderRows(
        this.prisma,
        ctx,
        orderId,
        now,
        ProfitOrigin.LIVE,
        [TireStorageStatus.ENTERED, TireStorageStatus.IN_WAREHOUSE],
      );
      const [facts, resolved, kept, shares] = await Promise.all([
        this.facts.byProfitRows(ctx.tenantId, orderId, lines),
        this.schemes.resolveAt(ctx.tenantId, now),
        this.keptEmployees(ctx.tenantId),
        this.profit.overheadShares(this.prisma, ctx, orderId, {
          walletId: previewWalletId,
          rows: lines,
        }),
      ]);
      applyBonusOverhead(facts, shares);
      return this.toModel(order, names, facts, {
        mode: OrderMotivationModeEnum.PREVIEW,
        schemeVersion: resolved.stored?.version ?? null,
        canCharge: false,
        items: fromResults(
          calculateMotivation(facts.items, resolved.scheme, kept),
          overheadByItem(facts.items),
        ),
      });
    }

    const [facts, accruals, shares] = await Promise.all([
      this.facts.byOrder(ctx.tenantId, orderId),
      this.prisma.motivationAccrual.findMany({
        where: { tenantId: ctx.tenantId, orderId },
        select: {
          itemId: true,
          itemType: true,
          stage: true,
          employeeId: true,
          positionId: true,
          amountAmount: true,
          outcome: true,
          reason: true,
          source: true,
          scheme: { select: { version: true } },
        },
        orderBy: { createdAt: 'asc' },
      }),
      this.profit.overheadShares(this.prisma, ctx, orderId),
    ]);
    applyBonusOverhead(facts, shares);

    if (accruals.length > 0) {
      // Позиции без фонда строк не дают, но в прогнозе они есть — показываем так же
      const items = new Map<string, ItemView>(
        facts.items.map((item) => [
          item.itemId,
          {
            itemId: item.itemId,
            type: item.type,
            profitMinor: item.profitMinor,
            overheadMinor: item.overheadMinor,
            rows: [],
          },
        ]),
      );
      for (const accrual of accruals) {
        const item = items.get(accrual.itemId) ?? {
          itemId: accrual.itemId,
          type: accrual.itemType as MotivationItemType,
          profitMinor: 0n,
          overheadMinor: 0n,
          rows: [],
        };
        item.rows.push({
          stage: accrual.stage as MotivationStage,
          employeeId: accrual.employeeId,
          positionId: accrual.positionId,
          amountMinor: accrual.amountAmount,
          outcome: accrual.outcome as MotivationRowOutcome,
          reason: accrual.reason as MotivationKeepReason | null,
          source: accrual.source as MotivationSourceRef | null,
        });
        items.set(accrual.itemId, item);
      }
      return this.toModel(order, names, facts, {
        mode: OrderMotivationModeEnum.ACCRUED,
        schemeVersion: accruals[0].scheme.version,
        canCharge: false,
        items: [...items.values()],
      });
    }

    const [resolved, kept] = await Promise.all([
      this.schemes.resolveAt(ctx.tenantId, order.closedAt),
      this.keptEmployees(ctx.tenantId),
    ]);
    return this.toModel(order, names, facts, {
      mode: OrderMotivationModeEnum.NOT_ACCRUED,
      schemeVersion: resolved.stored?.version ?? null,
      canCharge:
        !order.cancelled && resolved.stored !== null && facts.items.length > 0,
      items: fromResults(
        calculateMotivation(facts.items, resolved.scheme, kept),
        overheadByItem(facts.items),
      ),
    });
  }

  private toModel(
    order: OrderState,
    names: Awaited<ReturnType<typeof loadMotivationNames>>,
    facts: MotivationFacts,
    view: {
      mode: OrderMotivationModeEnum;
      schemeVersion: number | null;
      canCharge: boolean;
      items: ItemView[];
    },
  ): OrderMotivationModel {
    const labels = new Map(
      facts.items.map((item) => [item.itemId, item.label]),
    );
    const totals = new Map<string, bigint>();
    for (const row of view.items.flatMap((item) => item.rows)) {
      if (row.outcome !== 'ACCRUED' || !row.employeeId) continue;
      totals.set(
        row.employeeId,
        (totals.get(row.employeeId) ?? 0n) + row.amountMinor,
      );
    }
    return {
      orderId: order.id,
      orderNumber: order.number,
      mode: view.mode,
      schemeVersion: view.schemeVersion,
      canCharge: view.canCharge,
      employees: [...totals]
        .map(([employeeId, amount]) => ({
          employeeId,
          employeeName: employeeName(names, employeeId),
          amount,
        }))
        .sort((a, b) =>
          a.amount === b.amount ? 0 : a.amount > b.amount ? -1 : 1,
        ),
      items: view.items.map((item) => ({
        itemId: item.itemId,
        type: item.type as MotivationItemTypeEnum,
        label: labels.get(item.itemId) ?? '',
        profit: item.profitMinor,
        overhead: item.overheadMinor,
        fund: item.rows.reduce((sum, row) => sum + row.amountMinor, 0n),
        rows: item.rows.map((row) => toBreakdownRow(row, names)),
      })),
      excluded: facts.excluded.map(toExcludedItem),
    };
  }

  private async loadOrder(
    tenantId: string,
    orderId: string,
  ): Promise<OrderState> {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, tenantId },
      select: {
        id: true,
        number: true,
        close: {
          select: {
            orderDeal: { select: { createdAt: true } },
            orderCancel: { select: { id: true } },
          },
        },
      },
    });
    if (!order) throw new NotFoundException('Заказ не найден');
    if (!order.close) {
      return {
        id: order.id,
        number: order.number,
        closedAt: null,
        cancelled: false,
      };
    }
    // Схему выбираем по моменту снапшота прибыли — он и есть закрытие сделки
    const profit = await this.prisma.orderItemProfit.findFirst({
      where: { orderId },
      select: { closedAt: true },
    });
    return {
      id: order.id,
      number: order.number,
      closedAt:
        profit?.closedAt ?? order.close.orderDeal?.createdAt ?? new Date(),
      cancelled: !!order.close.orderCancel || !order.close.orderDeal,
    };
  }

  /**
   * Как у сдельной ЗП: уволен на момент начисления — не получает.
   * «Только оклад» — тоже не получает, доля остаётся организации.
   */
  private async keptEmployees(
    tenantId: string,
  ): Promise<MotivationCalculationOptions> {
    const employees = await this.prisma.employee.findMany({
      where: {
        tenantId,
        OR: [{ firedAt: { not: null } }, { salaryOnly: true }],
      },
      select: { id: true, firedAt: true, salaryOnly: true },
    });
    return {
      firedEmployeeIds: new Set(
        employees.filter((e) => e.firedAt !== null).map((e) => e.id),
      ),
      salaryOnlyEmployeeIds: new Set(
        employees.filter((e) => e.salaryOnly).map((e) => e.id),
      ),
    };
  }

  private async isCharged(tenantId: string, orderId: string) {
    const [accrual, posting] = await Promise.all([
      this.prisma.motivationAccrual.findFirst({
        where: { tenantId, orderId },
        select: { id: true },
      }),
      this.prisma.customerTransaction.findFirst({
        where: {
          tenantId,
          source: CustomerTransactionSource.OrderMotivation,
          sourceId: orderId,
        },
        select: { id: true },
      }),
    ]);
    return !!accrual || !!posting;
  }
}

/** Вычитает расходы из базы бонуса. Прибыль в снапшоте при этом не меняется. */
function applyBonusOverhead(
  facts: MotivationFacts,
  shares: ReadonlyMap<string, bigint>,
): void {
  for (const item of facts.items) {
    const share = toMoney(shares.get(item.itemId) ?? 0n, '', '');
    const profit = toMoney(item.profitMinor, '', '');
    item.overheadMinor = share.amountMinor;
    item.profitMinor = subtract(profit, share).amountMinor;
  }
}

function overheadByItem(
  items: Array<{ itemId: string; overheadMinor: bigint }>,
): Map<string, bigint> {
  return new Map(items.map((item) => [item.itemId, item.overheadMinor]));
}

function fromResults(
  results: MotivationItemResult[],
  overheadOf: ReadonlyMap<string, bigint>,
): ItemView[] {
  return results.map((result) => ({
    itemId: result.itemId,
    type: result.type,
    profitMinor: result.profitMinor,
    overheadMinor: overheadOf.get(result.itemId) ?? 0n,
    rows: result.rows,
  }));
}
