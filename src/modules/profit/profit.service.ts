import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from 'src/generated/prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { CogsService } from 'src/modules/cogs/cogs.service';
import { EmployeeService } from 'src/modules/employee/employee.service';
import { SettingsService } from 'src/modules/settings/settings.service';
import { CustomerTransactionSource } from 'src/modules/customer-transaction/enums/customer-transaction-source.enum';
import { OrderItemServiceKind } from 'src/modules/order/enums/order-item-service-kind.enum';
import { WarrantyPayerKind } from 'src/modules/order/enums/warranty-payer-kind.enum';
import { PartyKind } from 'src/common/party';
import type { AuthContext } from 'src/common/user-id.store';
import {
  addDays,
  startOfDay,
  toZonedParts,
  zonedToUtc,
} from 'src/common/utils/zoned-time.util';
import { aggregateOrderProfit } from './aggregate-order-profit';
import { computeLineProfit } from './compute-line-profit';
import {
  distributeLegacySalaryCost,
  type LegacyServiceLine,
} from './distribute-legacy-salary';
import { calcPartsMarginPercent, estimatePartCostFromMarkup } from './estimate-part-cost';
import { ProfitCostBasis } from './enums/profit-cost-basis.enum';
import { ProfitLineKind } from './enums/profit-line-kind.enum';
import { ProfitOrigin } from './enums/profit-origin.enum';
import type { BackfillOrderProfitsInput } from './inputs/backfill-order-profits.input';
import type { OrderProfitModel } from './models/order-profit.model';
import type { PeriodProfitModel } from './models/period-profit.model';
import type { PeriodProfitSummaryModel } from './models/period-profit-summary.model';
import type { PeriodOrderProfitModel } from './models/period-order-profit.model';

type EmployeeRow = Awaited<
  ReturnType<EmployeeService['findByPersonId']>
>;

type LegacySnapshotContext = {
  salaryByPerson: Map<string, bigint>;
  serviceLines: LegacyServiceLine[];
};

const BACKFILL_DEFAULT_LIMIT = 1000;

@Injectable()
export class ProfitService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cogsService: CogsService,
    private readonly employeeService: EmployeeService,
    private readonly settingsService: SettingsService,
  ) {}

  /**
   * Снапшот прибыли по всем работам и запчастям заказа.
   * Идемпотентен: перезаписывает строки заказа.
   */
  async snapshotOrder(
    tx: Prisma.TransactionClient,
    ctx: AuthContext,
    orderId: string,
    closedAt: Date,
    origin: ProfitOrigin = ProfitOrigin.LIVE,
  ): Promise<number> {
    const order = await tx.order.findFirst({
      where: { id: orderId, tenantId: ctx.tenantId },
      select: { id: true, tenantId: true },
    });
    if (!order) {
      throw new NotFoundException(`Заказ с ID ${orderId} не найден`);
    }

    const currencyCode = await this.settingsService.getDefaultCurrencyCode();
    const items = await tx.orderItem.findMany({
      where: { orderId, tenantId: ctx.tenantId },
      include: { service: true, part: true },
    });

    const employeeCache = new Map<string, EmployeeRow>();
    const legacyContext =
      origin === ProfitOrigin.LEGACY_BACKFILL
        ? await this.buildLegacySnapshotContext(tx, ctx, orderId, items)
        : undefined;

    const rows: Prisma.OrderItemProfitCreateManyInput[] = [];

    for (const item of items) {
      if (item.service) {
        rows.push(
          await this.buildServiceRow(
            ctx,
            item.id,
            orderId,
            order.tenantId,
            item.service,
            closedAt,
            origin,
            currencyCode,
            employeeCache,
            legacyContext,
          ),
        );
      } else if (item.part) {
        rows.push(
          await this.buildPartRow(
            ctx,
            item.id,
            orderId,
            order.tenantId,
            item.part,
            closedAt,
            origin,
            currencyCode,
          ),
        );
      }
    }

    await tx.orderItemProfit.deleteMany({ where: { orderId } });

    if (rows.length > 0) {
      await tx.orderItemProfit.createMany({ data: rows });
    }

    return rows.length;
  }

  /** Строки снапшота прибыли по заказу (без проверки статуса заказа). */
  async findItemProfitRows(ctx: AuthContext, orderId: string) {
    return this.prisma.orderItemProfit.findMany({
      where: { orderId, tenantId: ctx.tenantId },
      include: {
        orderItem: {
          include: {
            service: true,
            part: { include: { part: true } },
          },
        },
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
  }

  async summarizeOrderProfit(
    ctx: AuthContext,
    orderId: string,
  ): Promise<OrderProfitModel | null> {
    const rows = await this.findItemProfitRows(ctx, orderId);
    if (!rows.length) {
      return null;
    }

    return aggregateOrderProfit(rows);
  }

  /** Граница бэкофилла: MIN(income_accrue.created_at) тенанта. */
  async getBackfillBoundary(tenantId: string): Promise<Date | null> {
    const result = await this.prisma.incomeAccrue.aggregate({
      where: { tenantId },
      _min: { createdAt: true },
    });
    return result._min.createdAt ?? null;
  }

  /**
   * Бэкофилл исторических сделок (origin=LEGACY_BACKFILL).
   * Пропускает заказы с LIVE-снапшотом.
   */
  async backfillOrderProfits(
    ctx: AuthContext,
    input?: BackfillOrderProfitsInput,
  ): Promise<number> {
    const boundary = await this.getBackfillBoundary(ctx.tenantId);
    if (!boundary) {
      return 0;
    }

    const limit = input?.limit ?? BACKFILL_DEFAULT_LIMIT;
    const skip = input?.skip ?? 0;

    const orders = await this.prisma.order.findMany({
      where: {
        tenantId: ctx.tenantId,
        close: {
          is: {
            orderDeal: { is: { createdAt: { gte: boundary } } },
            orderCancel: { is: null },
          },
        },
        NOT: {
          itemProfits: { some: { origin: ProfitOrigin.LIVE } },
        },
      },
      select: {
        id: true,
        close: { select: { orderDeal: { select: { createdAt: true } } } },
      },
      orderBy: { number: 'desc' },
      skip,
      take: limit,
    });

    let processed = 0;
    for (const order of orders) {
      const closedAt = order.close?.orderDeal?.createdAt ?? new Date();
      await this.prisma.$transaction((tx) =>
        this.snapshotOrder(
          tx,
          ctx,
          order.id,
          closedAt,
          ProfitOrigin.LEGACY_BACKFILL,
        ),
      );
      processed++;
    }

    return processed;
  }

  async getPeriodProfit(
    ctx: AuthContext,
    dateFrom: Date,
    dateTo: Date,
  ): Promise<PeriodProfitModel> {
    const boundary = await this.getBackfillBoundary(ctx.tenantId);
    const tz = await this.settingsService.getTimezone(ctx.tenantId);
    const currentBounds = this.resolvePeriodBounds(dateFrom, dateTo, tz);
    const previousBounds = this.shiftPeriodBoundsByYear(currentBounds, tz, -1);

    const [current, previousYear] = await Promise.all([
      this.aggregatePeriodSummary(
        ctx,
        currentBounds.from,
        currentBounds.toExclusive,
      ),
      this.aggregatePeriodSummary(
        ctx,
        previousBounds.from,
        previousBounds.toExclusive,
      ),
    ]);

    return {
      dateFrom,
      dateTo,
      backfillBoundary: boundary,
      hasIncompleteHistory: boundary ? dateFrom < boundary : true,
      current,
      previousYear,
    };
  }

  private async aggregatePeriodSummary(
    ctx: AuthContext,
    dateFrom: Date,
    dateToExclusive: Date,
  ): Promise<PeriodProfitSummaryModel> {
    const where: Prisma.OrderItemProfitWhereInput = {
      tenantId: ctx.tenantId,
      closedAt: { gte: dateFrom, lt: dateToExclusive },
    };

    const contractorWhere: Prisma.OrderItemProfitWhereInput = {
      ...where,
      kind: ProfitLineKind.SERVICE,
      orderItem: {
        service: {
          OR: [
            { kind: OrderItemServiceKind.CONTRACTOR },
            { executorKind: PartyKind.ORGANIZATION },
          ],
        },
      },
    };

    const [totalAgg, worksAgg, partsAgg, contractorAgg, ordersCount] =
      await Promise.all([
        this.prisma.orderItemProfit.aggregate({
          where,
          _sum: {
            revenueAmount: true,
            costAmount: true,
            profitAmount: true,
          },
        }),
        this.prisma.orderItemProfit.aggregate({
          where: { ...where, kind: ProfitLineKind.SERVICE },
          _sum: { profitAmount: true },
        }),
        this.prisma.orderItemProfit.aggregate({
          where: { ...where, kind: ProfitLineKind.PART },
          _sum: { profitAmount: true },
        }),
        this.prisma.orderItemProfit.aggregate({
          where: contractorWhere,
          _sum: { profitAmount: true },
        }),
        this.prisma.orderItemProfit.groupBy({
          by: ['orderId'],
          where,
        }),
      ]);

    return {
      grossRevenueAmount: totalAgg._sum.revenueAmount ?? 0n,
      grossCostAmount: totalAgg._sum.costAmount ?? 0n,
      grossProfitAmount: totalAgg._sum.profitAmount ?? 0n,
      worksProfitAmount: worksAgg._sum.profitAmount ?? 0n,
      partsProfitAmount: partsAgg._sum.profitAmount ?? 0n,
      contractorProfitAmount: contractorAgg._sum.profitAmount ?? 0n,
      ordersCount: ordersCount.length,
    };
  }

  async getPeriodOrderProfits(
    ctx: AuthContext,
    dateFrom: Date,
    dateTo: Date,
    take = 25,
    skip = 0,
  ): Promise<{ items: PeriodOrderProfitModel[]; total: number }> {
    const tz = await this.settingsService.getTimezone(ctx.tenantId);
    const { from, toExclusive } = this.resolvePeriodBounds(dateFrom, dateTo, tz);
    const profitWhere: Prisma.OrderItemProfitWhereInput = {
      tenantId: ctx.tenantId,
      closedAt: { gte: from, lt: toExclusive },
    };

    const orderWhere: Prisma.OrderWhereInput = {
      tenantId: ctx.tenantId,
      itemProfits: { some: profitWhere },
    };

    const [total, orders] = await Promise.all([
      this.prisma.order.count({ where: orderWhere }),
      this.prisma.order.findMany({
        where: orderWhere,
        select: {
          id: true,
          number: true,
          itemProfits: {
            where: profitWhere,
            select: {
              kind: true,
              revenueAmount: true,
              costAmount: true,
              profitAmount: true,
              closedAt: true,
            },
          },
          close: {
            select: {
              orderDeal: { select: { createdAt: true } },
            },
          },
        },
        orderBy: { number: 'desc' },
        skip,
        take,
      }),
    ]);

    const items = orders.map((order) => {
      let revenueAmount = 0n;
      let costAmount = 0n;
      let profitAmount = 0n;
      let worksProfitAmount = 0n;
      let partsProfitAmount = 0n;
      let partsRevenueAmount = 0n;
      let partsCostAmount = 0n;

      for (const row of order.itemProfits) {
        revenueAmount += row.revenueAmount;
        costAmount += row.costAmount;
        profitAmount += row.profitAmount;
        if (row.kind === ProfitLineKind.SERVICE) {
          worksProfitAmount += row.profitAmount;
        } else if (row.kind === ProfitLineKind.PART) {
          partsProfitAmount += row.profitAmount;
          partsRevenueAmount += row.revenueAmount;
          partsCostAmount += row.costAmount;
        }
      }

      const closedAt =
        order.close?.orderDeal?.createdAt ??
        order.itemProfits[0]?.closedAt ??
        dateFrom;

      return {
        orderId: order.id,
        orderNumber: order.number,
        closedAt,
        revenueAmount,
        costAmount,
        profitAmount,
        worksProfitAmount,
        partsProfitAmount,
        partsRevenueAmount,
        partsCostAmount,
        partsMarginPercent: calcPartsMarginPercent(
          partsProfitAmount,
          partsRevenueAmount,
        ),
      };
    });

    return { items, total };
  }

  /** Идемпотентный пересчёт снапshota для закрытой сделки (не отмены). */
  async recomputeOrderProfit(
    ctx: AuthContext,
    orderId: string,
    origin: ProfitOrigin = ProfitOrigin.LIVE,
  ): Promise<number> {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, tenantId: ctx.tenantId },
      select: {
        close: {
          select: {
            orderCancel: { select: { id: true } },
            orderDeal: { select: { createdAt: true } },
          },
        },
      },
    });
    if (!order?.close?.orderDeal) {
      throw new BadRequestException('Заказ не закрыт как сделка');
    }
    if (order.close.orderCancel) {
      throw new BadRequestException('Отменённый заказ не имеет снапшота прибыли');
    }

    const closedAt = order.close.orderDeal.createdAt ?? new Date();

    return this.prisma.$transaction(async (tx) =>
      this.snapshotOrder(tx, ctx, orderId, closedAt, origin),
    );
  }

  private async buildLegacySnapshotContext(
    tx: Prisma.TransactionClient,
    ctx: AuthContext,
    orderId: string,
    items: Array<{
      id: string;
      service: {
        kind: string;
        executorKind: string | null;
        executorId: string | null;
        warranty: boolean;
        priceAmount: bigint | null;
        discountAmount: bigint | null;
      } | null;
    }>,
  ): Promise<LegacySnapshotContext> {
    const salaryByPerson = await this.loadOrderSalaryByPerson(tx, ctx, orderId);
    const serviceLines: LegacyServiceLine[] = items
      .filter((item) => item.service)
      .map((item) => {
        const service = item.service!;
        return {
          orderItemId: item.id,
          executorId: service.executorId,
          executorKind: service.executorKind,
          kind: service.kind,
          net: (service.priceAmount ?? 0n) - (service.discountAmount ?? 0n),
          warranty: service.warranty,
        };
      });

    return { salaryByPerson, serviceLines };
  }

  private async loadOrderSalaryByPerson(
    tx: Prisma.TransactionClient,
    ctx: AuthContext,
    orderId: string,
  ): Promise<Map<string, bigint>> {
    const txs = await tx.customerTransaction.findMany({
      where: {
        tenantId: ctx.tenantId,
        source: CustomerTransactionSource.OrderSalary,
        sourceId: orderId,
      },
      select: { operandId: true, amountAmount: true },
    });

    const map = new Map<string, bigint>();
    for (const row of txs) {
      const amount = this.absAmount(row.amountAmount ?? 0n);
      if (amount <= 0n) continue;
      map.set(row.operandId, (map.get(row.operandId) ?? 0n) + amount);
    }
    return map;
  }

  private async buildServiceRow(
    ctx: AuthContext,
    orderItemId: string,
    orderId: string,
    tenantId: string,
    service: {
      kind: string;
      executorKind: string | null;
      executorId: string | null;
      warranty: boolean;
      warrantyPayerKind: string | null;
      priceAmount: bigint | null;
      discountAmount: bigint | null;
      costAmount: bigint | null;
    },
    closedAt: Date,
    origin: ProfitOrigin,
    currencyCode: string,
    employeeCache: Map<string, EmployeeRow>,
    legacyContext?: LegacySnapshotContext,
  ): Promise<Prisma.OrderItemProfitCreateManyInput> {
    const net = (service.priceAmount ?? 0n) - (service.discountAmount ?? 0n);

    if (origin === ProfitOrigin.LEGACY_BACKFILL && service.warranty) {
      return {
        orderItemId,
        orderId,
        tenantId,
        kind: ProfitLineKind.SERVICE,
        revenueAmount: 0n,
        costAmount: 0n,
        profitAmount: 0n,
        currencyCode,
        costBasis: ProfitCostBasis.NONE,
        origin,
        warranty: true,
        warrantyPayerKind: null,
        closedAt,
      };
    }

    let cost: bigint;
    let costBasis: ProfitCostBasis;

    if (origin === ProfitOrigin.LEGACY_BACKFILL && legacyContext) {
      const line: LegacyServiceLine = {
        orderItemId,
        executorId: service.executorId,
        executorKind: service.executorKind,
        kind: service.kind,
        net,
        warranty: service.warranty,
      };
      ({ cost, costBasis } = distributeLegacySalaryCost(
        line,
        legacyContext.serviceLines,
        legacyContext.salaryByPerson,
      ));
    } else {
      ({ cost, costBasis } = await this.resolveServiceCost(
        ctx,
        service,
        net,
        employeeCache,
      ));
    }

    const amounts = computeLineProfit({
      kind: ProfitLineKind.SERVICE,
      revenue: net,
      cost,
      warranty: service.warranty,
      warrantyPayerKind: service.warrantyPayerKind,
    });

    const effectiveCostBasis =
      service.warranty && service.warrantyPayerKind !== WarrantyPayerKind.ORGANIZATION
        ? ProfitCostBasis.NONE
        : costBasis;

    return {
      orderItemId,
      orderId,
      tenantId,
      kind: ProfitLineKind.SERVICE,
      revenueAmount: amounts.revenueAmount,
      costAmount: amounts.costAmount,
      profitAmount: amounts.profitAmount,
      currencyCode,
      costBasis: effectiveCostBasis,
      origin,
      warranty: service.warranty,
      warrantyPayerKind: service.warrantyPayerKind,
      closedAt,
    };
  }

  private async buildPartRow(
    ctx: AuthContext,
    orderItemId: string,
    orderId: string,
    tenantId: string,
    part: {
      partId: string;
      quantity: number;
      warranty: boolean;
      warrantyPayerKind: string | null;
      priceAmount: bigint | null;
      discountAmount: bigint | null;
    },
    closedAt: Date,
    origin: ProfitOrigin,
    currencyCode: string,
  ): Promise<Prisma.OrderItemProfitCreateManyInput> {
    const unitNet =
      (part.priceAmount ?? 0n) - (part.discountAmount ?? 0n);
    const revenue = (unitNet * BigInt(part.quantity)) / 100n;

    if (origin === ProfitOrigin.LEGACY_BACKFILL && part.warranty) {
      return {
        orderItemId,
        orderId,
        tenantId,
        kind: ProfitLineKind.PART,
        revenueAmount: 0n,
        costAmount: 0n,
        profitAmount: 0n,
        currencyCode,
        costBasis: ProfitCostBasis.NONE,
        origin,
        warranty: true,
        warrantyPayerKind: null,
        closedAt,
      };
    }

    const cogs = await this.cogsService.getPartLineCogsAtDate(
      ctx.tenantId,
      part.partId,
      part.quantity,
      closedAt,
    );
    const { cost, costBasis } = this.resolvePartCost(origin, revenue, cogs);

    const amounts = computeLineProfit({
      kind: ProfitLineKind.PART,
      revenue,
      cost,
      warranty: part.warranty,
      warrantyPayerKind: part.warrantyPayerKind,
    });

    return {
      orderItemId,
      orderId,
      tenantId,
      kind: ProfitLineKind.PART,
      revenueAmount: amounts.revenueAmount,
      costAmount: amounts.costAmount,
      profitAmount: amounts.profitAmount,
      currencyCode,
      costBasis,
      origin,
      warranty: part.warranty,
      warrantyPayerKind: part.warrantyPayerKind,
      closedAt,
    };
  }

  private resolvePartCost(
    origin: ProfitOrigin,
    revenue: bigint,
    cogs: bigint,
  ): { cost: bigint; costBasis: ProfitCostBasis } {
    if (cogs > 0n) {
      return { cost: cogs, costBasis: ProfitCostBasis.LAST_INCOME };
    }

    if (origin === ProfitOrigin.LEGACY_BACKFILL && revenue > 0n) {
      return {
        cost: estimatePartCostFromMarkup(revenue),
        costBasis: ProfitCostBasis.ESTIMATED_MARKUP,
      };
    }

    return { cost: 0n, costBasis: ProfitCostBasis.NONE };
  }

  private async resolveServiceCost(
    ctx: AuthContext,
    service: {
      kind: string;
      executorKind: string | null;
      executorId: string | null;
      costAmount: bigint | null;
    },
    net: bigint,
    employeeCache: Map<string, EmployeeRow>,
  ): Promise<{ cost: bigint; costBasis: ProfitCostBasis }> {
    if (service.kind === OrderItemServiceKind.CONTRACTOR) {
      const cost = service.costAmount ?? 0n;
      return {
        cost,
        costBasis:
          cost > 0n ? ProfitCostBasis.CONTRACTOR : ProfitCostBasis.NONE,
      };
    }

    if (
      service.executorKind === PartyKind.PERSON &&
      service.executorId &&
      net > 0n
    ) {
      let employee = employeeCache.get(service.executorId);
      if (employee === undefined) {
        employee = await this.employeeService.findByPersonId(
          ctx,
          service.executorId,
        );
        employeeCache.set(service.executorId, employee);
      }
      if (employee?.ratio != null && !employee.firedAt) {
        const cost = (net * BigInt(employee.ratio)) / 100n;
        return { cost, costBasis: ProfitCostBasis.SALARY };
      }
    }

    return { cost: 0n, costBasis: ProfitCostBasis.NONE };
  }

  private resolvePeriodBounds(
    dateFrom: Date,
    dateTo: Date,
    tz: string,
  ): { from: Date; toExclusive: Date } {
    const from = startOfDay(dateFrom, tz);
    const toExclusive = addDays(startOfDay(dateTo, tz), 1);
    return { from, toExclusive };
  }

  /** Сдвигает календарный период на years лет в зоне тенанта. */
  private shiftPeriodBoundsByYear(
    bounds: { from: Date; toExclusive: Date },
    tz: string,
    years: number,
  ): { from: Date; toExclusive: Date } {
    const zFrom = toZonedParts(bounds.from, tz);
    const lastIncludedDay = addDays(bounds.toExclusive, -1);
    const zTo = toZonedParts(lastIncludedDay, tz);
    return {
      from: zonedToUtc(
        zFrom.year + years,
        zFrom.month,
        zFrom.day,
        0,
        0,
        0,
        tz,
      ),
      toExclusive: addDays(
        zonedToUtc(zTo.year + years, zTo.month, zTo.day, 0, 0, 0, tz),
        1,
      ),
    };
  }

  private absAmount(value: bigint): bigint {
    return value < 0n ? -value : value;
  }
}
