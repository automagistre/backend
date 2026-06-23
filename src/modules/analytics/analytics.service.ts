import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { OrderStatus } from 'src/modules/order/enums/order-status.enum';
import {
  TaskStatusEnum,
  TaskTypeEnum,
} from 'src/modules/tasks/enums/task.enums';
import {
  DAY_MS,
  type DateRange,
  calcMonthYoyRanges,
  dayKey,
  startOfDay,
  toZonedParts,
  zonedDayKey,
} from 'src/common/utils/zoned-time.util';
import type { Money } from 'src/common/money/money.types';
import { add, subtract, toMoney } from 'src/common/money/money.util';
import type {
  AvgCheckValue,
  ClientsMixValue,
  DailyRevenue,
  EmployeeDebt,
  EmployeeDebtSummary,
  IncomeLast7Days,
  MechanicHourRevenue,
  MonthlyClientsPair,
  MonthlyRevenuePair,
  OpenOrdersTotals,
  OperationsKpi,
  PartsMarginValue,
  RecommendationsValue,
  RevenueBreakdown,
  WalletBalance,
  WarrantyLast30Days,
  WarrantyOrder,
} from './analytics.types';

/**
 * Переиспользуемые аналитические расчёты по тенанту: выручка, маржа, средний чек,
 * загрузка, рекомендации, клиенты и т.д. Не зависит от presentation-слоя.
 *
 * Все денежные значения возвращаются как Money (валюта = currencyCode параметра,
 * для счетов — валюта счёта). Сырой bigint — только промежуточный элемент.
 */
@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  private money(amountMinor: bigint, currencyCode: string): Money {
    return toMoney(amountMinor, null, currencyCode);
  }

  // ---------- Сумма работ/запчастей по открытым заказам ----------

  async getOpenOrdersTotals(
    tenantId: string,
    currencyCode: string,
  ): Promise<OpenOrdersTotals> {
    const rows = await this.prisma.$queryRawUnsafe<
      Array<{ works: bigint; parts: bigint; orders_count: bigint }>
    >(
      `SELECT
         COALESCE(SUM(CASE
           WHEN ois.id IS NOT NULL AND NOT ois.warranty
           THEN COALESCE(ois.price_amount, 0) - COALESCE(ois.discount_amount, 0)
         END), 0)::bigint AS works,
         COALESCE(SUM(CASE
           WHEN oip.id IS NOT NULL AND NOT oip.warranty
           THEN ((COALESCE(oip.price_amount, 0) - COALESCE(oip.discount_amount, 0)) * oip.quantity) / 100
         END), 0)::bigint AS parts,
         COUNT(DISTINCT o.id)::bigint AS orders_count
       FROM orders o
       JOIN order_item oi ON oi.order_id = o.id
       LEFT JOIN order_item_service ois ON ois.id = oi.id
       LEFT JOIN order_item_part oip ON oip.id = oi.id
       WHERE o.tenant_id = $1::uuid
         AND o.status NOT IN ($2, $3)`,
      tenantId,
      OrderStatus.CLOSED,
      OrderStatus.CANCELLED,
    );
    const row = rows[0] ?? { works: 0n, parts: 0n, orders_count: 0n };
    const works = this.money(BigInt(row.works), currencyCode);
    const parts = this.money(BigInt(row.parts), currencyCode);
    return {
      works,
      parts,
      total: add(works, parts),
      ordersCount: Number(row.orders_count),
    };
  }

  // ---------- Income by wallet за 7 дней ----------

  async getIncomeLast7Days(
    tenantId: string,
    tz: string,
    now: Date,
    defaultCurrencyCode: string,
  ): Promise<IncomeLast7Days> {
    const wallets = await this.prisma.wallet.findMany({
      where: { tenantId },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, currencyCode: true },
    });

    const days: Date[] = [];
    const todayStart = startOfDay(now, tz);
    for (let i = 6; i >= 0; i--) {
      days.push(new Date(todayStart.getTime() - i * DAY_MS));
    }

    if (wallets.length === 0) {
      return { days, series: [] };
    }

    const periodStart = days[0]!;
    const periodEnd = new Date(todayStart.getTime() + DAY_MS);
    const walletIds = wallets.map((w) => w.id);

    const rows = await this.prisma.$queryRawUnsafe<
      Array<{ day_start: Date; wallet_id: string; income: bigint }>
    >(
      `SELECT
         date_trunc('day', (created_at AT TIME ZONE $1))::timestamp AS day_start,
         wallet_id,
         COALESCE(SUM(CASE WHEN amount_amount > 0 THEN amount_amount ELSE 0 END), 0)::bigint AS income
       FROM wallet_transaction
       WHERE tenant_id = $2::uuid
         AND wallet_id = ANY($3::uuid[])
         AND created_at >= $4
         AND created_at < $5
       GROUP BY day_start, wallet_id`,
      tz,
      tenantId,
      walletIds,
      periodStart,
      periodEnd,
    );

    const byWallet = new Map<string, Map<string, bigint>>();
    for (const w of wallets) byWallet.set(w.id, new Map());
    for (const r of rows) {
      const key = dayKey(r.day_start);
      const m = byWallet.get(r.wallet_id);
      if (m) m.set(key, BigInt(r.income));
    }

    const series = wallets
      .map((w) => {
        const cc = w.currencyCode ?? defaultCurrencyCode;
        const map = byWallet.get(w.id) ?? new Map<string, bigint>();
        const amounts = days.map((d) =>
          this.money(map.get(zonedDayKey(d, tz)) ?? 0n, cc),
        );
        const totalMinor = amounts.reduce<bigint>(
          (a, b) => a + b.amountMinor,
          0n,
        );
        return {
          walletId: w.id,
          walletName: w.name,
          amounts,
          totalMinor,
        };
      })
      .filter((s) => s.totalMinor > 0n)
      .sort((a, b) =>
        a.totalMinor > b.totalMinor ? -1 : a.totalMinor < b.totalMinor ? 1 : 0,
      )
      .map(({ totalMinor: _t, ...rest }) => rest);

    return { days, series };
  }

  // ---------- Остатки по счетам (showInLayout) ----------

  async getWalletBalances(
    tenantId: string,
    defaultCurrencyCode: string,
  ): Promise<WalletBalance[]> {
    const wallets = await this.prisma.wallet.findMany({
      where: { tenantId, showInLayout: true },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, currencyCode: true, balance: true },
    });
    return wallets.map((w) => ({
      walletId: w.id,
      walletName: w.name,
      // wallet.balance — Decimal в минорных единицах (копейки), конвертим в BigInt без потерь.
      balance: this.money(
        BigInt(w.balance.toFixed(0)),
        w.currencyCode ?? defaultCurrencyCode,
      ),
    }));
  }

  // ---------- Revenue last 7 days (accrued, разбивка works/parts) ----------

  async getRevenueLast7Days(
    tenantId: string,
    tz: string,
    now: Date,
    currencyCode: string,
  ): Promise<DailyRevenue[]> {
    const days: Date[] = [];
    const todayStart = startOfDay(now, tz);
    for (let i = 6; i >= 0; i--) {
      days.push(new Date(todayStart.getTime() - i * DAY_MS));
    }

    const periodStart = days[0]!;
    const periodEnd = new Date(todayStart.getTime() + DAY_MS);
    const byKey = await this.getDailyRevenueMap(
      tenantId,
      tz,
      periodStart,
      periodEnd,
    );

    return days.map((d) => {
      const row = byKey.get(zonedDayKey(d, tz));
      const works = this.money(row?.works ?? 0n, currencyCode);
      const parts = this.money(row?.parts ?? 0n, currencyCode);
      return { day: d, works, parts, total: add(works, parts) };
    });
  }

  /** Accrued выручка из закрытых сделкой заказов, агрегированная по дням локальной TZ. */
  private async getDailyRevenueMap(
    tenantId: string,
    tz: string,
    periodStart: Date,
    periodEnd: Date,
  ): Promise<Map<string, { works: bigint; parts: bigint }>> {
    const rows = await this.prisma.$queryRawUnsafe<
      Array<{ day_start: Date; works: bigint; parts: bigint }>
    >(
      `SELECT
         date_trunc('day', (od.created_at AT TIME ZONE $1))::timestamp AS day_start,
         COALESCE(SUM(CASE
           WHEN ois.id IS NOT NULL AND NOT ois.warranty
           THEN COALESCE(ois.price_amount, 0) - COALESCE(ois.discount_amount, 0)
         END), 0)::bigint AS works,
         COALESCE(SUM(CASE
           WHEN oip.id IS NOT NULL AND NOT oip.warranty
           THEN ((COALESCE(oip.price_amount, 0) - COALESCE(oip.discount_amount, 0)) * oip.quantity) / 100
         END), 0)::bigint AS parts
       FROM orders o
       JOIN order_close oc ON oc.order_id = o.id
       JOIN order_deal od ON od.id = oc.id
       JOIN order_item oi ON oi.order_id = o.id
       LEFT JOIN order_item_service ois ON ois.id = oi.id
       LEFT JOIN order_item_part oip ON oip.id = oi.id
       WHERE o.tenant_id = $2::uuid
         AND od.created_at >= $3
         AND od.created_at < $4
       GROUP BY day_start
       ORDER BY day_start`,
      tz,
      tenantId,
      periodStart,
      periodEnd,
    );

    const byKey = new Map<string, { works: bigint; parts: bigint }>();
    for (const r of rows) {
      byKey.set(dayKey(r.day_start), {
        works: BigInt(r.works),
        parts: BigInt(r.parts),
      });
    }
    return byKey;
  }

  // ---------- Employee debts ----------

  async getEmployeeDebts(
    tenantId: string,
    currencyCode: string,
  ): Promise<EmployeeDebtSummary> {
    const rows = await this.prisma.$queryRawUnsafe<
      Array<{
        employee_id: string;
        person_id: string;
        full_name: string;
        balance: bigint;
      }>
    >(
      `SELECT
         e.id AS employee_id,
         e.person_id,
         TRIM(BOTH ' ' FROM (COALESCE(p.lastname, '') || ' ' || COALESCE(p.firstname, ''))) AS full_name,
         COALESCE(SUM(ct.amount_amount), 0)::bigint AS balance
       FROM employee e
       JOIN person p ON p.id = e.person_id
       LEFT JOIN customer_transaction ct
         ON ct.operand_id = e.person_id AND ct.tenant_id = $1::uuid
       WHERE e.tenant_id = $1::uuid AND e.fired_at IS NULL
       GROUP BY e.id, e.person_id, p.lastname, p.firstname
       ORDER BY ABS(COALESCE(SUM(ct.amount_amount), 0)) DESC, full_name ASC`,
      tenantId,
    );

    const items: EmployeeDebt[] = rows.map((r) => ({
      employeeId: r.employee_id,
      personId: r.person_id,
      fullName: r.full_name || 'Без имени',
      balance: this.money(BigInt(r.balance), currencyCode),
    }));

    let totalOwedToEmployees = this.money(0n, currencyCode);
    let totalOwedByEmployees = this.money(0n, currencyCode);
    for (const item of items) {
      if (item.balance.amountMinor > 0n) {
        totalOwedToEmployees = add(totalOwedToEmployees, item.balance);
      } else if (item.balance.amountMinor < 0n) {
        totalOwedByEmployees = subtract(totalOwedByEmployees, item.balance);
      }
    }

    return { items, totalOwedToEmployees, totalOwedByEmployees };
  }

  // ---------- Operations KPI ----------

  async getOperationsKpi(tenantId: string): Promise<OperationsKpi> {
    const [activeOrders, readyOrders, qualityControlTasks, openTasks] =
      await Promise.all([
        this.prisma.order.count({
          where: {
            tenantId,
            status: { notIn: [OrderStatus.CLOSED, OrderStatus.CANCELLED] },
          },
        }),
        this.prisma.order.count({
          where: { tenantId, status: OrderStatus.READY },
        }),
        this.prisma.task.count({
          where: {
            tenantId,
            type: TaskTypeEnum.QUALITY_CONTROL,
            status: { in: [TaskStatusEnum.TODO, TaskStatusEnum.IN_PROGRESS] },
          },
        }),
        this.prisma.task.count({
          where: {
            tenantId,
            status: { in: [TaskStatusEnum.TODO, TaskStatusEnum.IN_PROGRESS] },
          },
        }),
      ]);

    return { activeOrders, readyOrders, qualityControlTasks, openTasks };
  }

  // ---------- Warranty за 30 дней ----------

  async getWarrantyLast30Days(
    tenantId: string,
    now: Date,
    currencyCode: string,
  ): Promise<WarrantyLast30Days> {
    const periodStart = new Date(now.getTime() - 30 * DAY_MS);

    const rows = await this.prisma.$queryRawUnsafe<
      Array<{
        order_id: string;
        order_number: number;
        closed_at: Date;
        customer_name: string | null;
        car_name: string | null;
        works: bigint;
        parts: bigint;
      }>
    >(
      `SELECT
         o.id AS order_id,
         o.number AS order_number,
         od.created_at AS closed_at,
         NULLIF(TRIM(BOTH ' ' FROM (COALESCE(p.lastname, '') || ' ' || COALESCE(p.firstname, ''))), '') AS customer_name,
         NULLIF(TRIM(BOTH ' ' FROM CONCAT_WS(' ',
           m.name, v.name,
           CASE WHEN c.gosnomer IS NOT NULL AND c.gosnomer <> '' THEN '· ' || c.gosnomer END
         )), '') AS car_name,
         COALESCE(SUM(CASE
           WHEN ois.id IS NOT NULL AND ois.warranty
           THEN COALESCE(ois.price_amount, 0) - COALESCE(ois.discount_amount, 0)
         END), 0)::bigint AS works,
         COALESCE(SUM(CASE
           WHEN oip.id IS NOT NULL AND oip.warranty
           THEN ((COALESCE(oip.price_amount, 0) - COALESCE(oip.discount_amount, 0)) * oip.quantity) / 100
         END), 0)::bigint AS parts
       FROM orders o
       JOIN order_close oc ON oc.order_id = o.id
       JOIN order_deal od ON od.id = oc.id
       JOIN order_item oi ON oi.order_id = o.id
       LEFT JOIN order_item_service ois ON ois.id = oi.id
       LEFT JOIN order_item_part oip ON oip.id = oi.id
       LEFT JOIN person p ON p.id = o.customer_id
       LEFT JOIN car c ON c.id = o.car_id
       LEFT JOIN vehicle_model v ON v.id = c.vehicle_id
       LEFT JOIN manufacturer m ON m.id = v.manufacturer_id
       WHERE o.tenant_id = $1::uuid
         AND od.created_at >= $2
         AND od.created_at <= $3
       GROUP BY o.id, o.number, od.created_at, p.lastname, p.firstname,
                m.name, v.name, c.gosnomer
       HAVING (
         COALESCE(SUM(CASE WHEN ois.id IS NOT NULL AND ois.warranty
                           THEN COALESCE(ois.price_amount, 0) - COALESCE(ois.discount_amount, 0)
                      END), 0)
         + COALESCE(SUM(CASE WHEN oip.id IS NOT NULL AND oip.warranty
                             THEN ((COALESCE(oip.price_amount, 0) - COALESCE(oip.discount_amount, 0)) * oip.quantity) / 100
                        END), 0)
       ) > 0
       ORDER BY od.created_at DESC`,
      tenantId,
      periodStart,
      now,
    );

    const orders: WarrantyOrder[] = rows.map((r) => {
      const works = this.money(BigInt(r.works), currencyCode);
      const parts = this.money(BigInt(r.parts), currencyCode);
      return {
        orderId: r.order_id,
        orderNumber: r.order_number,
        closedAt: r.closed_at,
        customerName: r.customer_name,
        carName: r.car_name,
        works,
        parts,
        total: add(works, parts),
      };
    });

    let totalWorks = this.money(0n, currencyCode);
    let totalParts = this.money(0n, currencyCode);
    for (const o of orders) {
      totalWorks = add(totalWorks, o.works);
      totalParts = add(totalParts, o.parts);
    }
    return {
      total: add(totalWorks, totalParts),
      totalWorks,
      totalParts,
      orders,
    };
  }

  // ---------- Monthly revenue: 6 последних месяцев, год к году ----------

  async getMonthlyRevenueLast6(
    tenantId: string,
    tz: string,
    now: Date,
    currencyCode: string,
  ): Promise<MonthlyRevenuePair[]> {
    const z = toZonedParts(now, tz);
    const slots: Array<{ year: number; month: number; isCurrent: boolean }> = [];
    for (let i = 5; i >= 0; i--) {
      const monthZeroBased = z.month - 1 - i;
      const year = z.year + Math.floor(monthZeroBased / 12);
      const month = ((monthZeroBased % 12) + 12) % 12 + 1;
      slots.push({ year, month, isCurrent: i === 0 });
    }

    const ranges = slots.map((s) =>
      calcMonthYoyRanges(s.year, s.month, s.isCurrent, now, tz),
    );

    const flat = ranges.flatMap((r) => [r.current, r.previous]);
    const revenues = await Promise.all(
      flat.map((r) => this.getRevenue(tenantId, r, currencyCode)),
    );

    return slots.map((slot, idx) => ({
      year: slot.year,
      month: slot.month,
      isCurrent: slot.isCurrent,
      current: revenues[idx * 2]!,
      previous: revenues[idx * 2 + 1]!,
    }));
  }

  /** Accrued выручка works/parts (без warranty) по закрытым сделкам за период. */
  async getRevenue(
    tenantId: string,
    range: DateRange,
    currencyCode: string,
  ): Promise<RevenueBreakdown> {
    const rows = await this.prisma.$queryRawUnsafe<
      Array<{ works: bigint; parts: bigint }>
    >(
      `SELECT
         COALESCE(SUM(CASE
           WHEN ois.id IS NOT NULL AND NOT ois.warranty
           THEN COALESCE(ois.price_amount, 0) - COALESCE(ois.discount_amount, 0)
         END), 0)::bigint AS works,
         COALESCE(SUM(CASE
           WHEN oip.id IS NOT NULL AND NOT oip.warranty
           THEN ((COALESCE(oip.price_amount, 0) - COALESCE(oip.discount_amount, 0)) * oip.quantity) / 100
         END), 0)::bigint AS parts
       FROM orders o
       JOIN order_close oc ON oc.order_id = o.id
       JOIN order_deal od ON od.id = oc.id
       JOIN order_item oi ON oi.order_id = o.id
       LEFT JOIN order_item_service ois ON ois.id = oi.id
       LEFT JOIN order_item_part oip ON oip.id = oi.id
       WHERE o.tenant_id = $1::uuid
         AND od.created_at >= $2
         AND od.created_at < $3`,
      tenantId,
      range.from,
      range.to,
    );
    const row = rows[0] ?? { works: 0n, parts: 0n };
    const works = this.money(BigInt(row.works), currencyCode);
    const parts = this.money(BigInt(row.parts), currencyCode);
    return { works, parts, total: add(works, parts) };
  }

  // ---------- Средний чек (AOV) ----------

  async getAvgCheck(
    tenantId: string,
    range: DateRange,
    currencyCode: string,
  ): Promise<AvgCheckValue> {
    const rows = await this.prisma.$queryRawUnsafe<
      Array<{ works: bigint; parts: bigint; orders_count: bigint }>
    >(
      `SELECT
         COALESCE(SUM(CASE
           WHEN ois.id IS NOT NULL AND NOT ois.warranty
           THEN COALESCE(ois.price_amount, 0) - COALESCE(ois.discount_amount, 0)
         END), 0)::bigint AS works,
         COALESCE(SUM(CASE
           WHEN oip.id IS NOT NULL AND NOT oip.warranty
           THEN ((COALESCE(oip.price_amount, 0) - COALESCE(oip.discount_amount, 0)) * oip.quantity) / 100
         END), 0)::bigint AS parts,
         COUNT(DISTINCT o.id)::bigint AS orders_count
       FROM orders o
       JOIN order_close oc ON oc.order_id = o.id
       JOIN order_deal od ON od.id = oc.id
       LEFT JOIN order_item oi ON oi.order_id = o.id
       LEFT JOIN order_item_service ois ON ois.id = oi.id
       LEFT JOIN order_item_part oip ON oip.id = oi.id
       WHERE o.tenant_id = $1::uuid
         AND od.created_at >= $2
         AND od.created_at < $3`,
      tenantId,
      range.from,
      range.to,
    );
    const row = rows[0] ?? { works: 0n, parts: 0n, orders_count: 0n };
    const revenueTotal = this.money(
      BigInt(row.works) + BigInt(row.parts),
      currencyCode,
    );
    const ordersCount = Number(row.orders_count);
    const avgCheck = this.money(
      ordersCount > 0 ? revenueTotal.amountMinor / BigInt(ordersCount) : 0n,
      currencyCode,
    );
    return { avgCheck, revenueTotal, ordersCount };
  }

  // ---------- Маржа запчастей ----------

  async getPartsMargin(
    tenantId: string,
    range: DateRange,
    currencyCode: string,
  ): Promise<PartsMarginValue> {
    // Продажи запчастей + COGS point-in-time (последняя закупка не новее закрытия заказа).
    const salesRows = await this.prisma.$queryRawUnsafe<
      Array<{ sales: bigint; cogs: bigint }>
    >(
      `SELECT
         COALESCE(SUM(((COALESCE(oip.price_amount, 0) - COALESCE(oip.discount_amount, 0)) * oip.quantity) / 100), 0)::bigint AS sales,
         COALESCE(SUM((COALESCE(lc.unit_cost, 0) * oip.quantity) / 100), 0)::bigint AS cogs
       FROM orders o
       JOIN order_close oc ON oc.order_id = o.id
       JOIN order_deal od ON od.id = oc.id
       JOIN order_item oi ON oi.order_id = o.id
       JOIN order_item_part oip ON oip.id = oi.id
       LEFT JOIN LATERAL (
         SELECT ip.price_amount AS unit_cost
         FROM income_part ip
         JOIN income i ON i.id = ip.income_id
         WHERE ip.part_id = oip.part_id
           AND ip.tenant_id = o.tenant_id
           AND i.created_at <= od.created_at
         ORDER BY i.created_at DESC
         LIMIT 1
       ) lc ON TRUE
       WHERE o.tenant_id = $1::uuid
         AND NOT oip.warranty
         AND od.created_at >= $2
         AND od.created_at < $3`,
      tenantId,
      range.from,
      range.to,
    );

    // Закупки за период (по дате прихода).
    const purchaseRows = await this.prisma.$queryRawUnsafe<
      Array<{ purchases: bigint }>
    >(
      `SELECT
         COALESCE(SUM((COALESCE(ip.price_amount, 0) * ip.quantity) / 100), 0)::bigint AS purchases
       FROM income_part ip
       JOIN income i ON i.id = ip.income_id
       WHERE ip.tenant_id = $1::uuid
         AND i.created_at >= $2
         AND i.created_at < $3`,
      tenantId,
      range.from,
      range.to,
    );

    const salesAmount = this.money(BigInt(salesRows[0]?.sales ?? 0n), currencyCode);
    const cogs = this.money(BigInt(salesRows[0]?.cogs ?? 0n), currencyCode);
    const purchasesAmount = this.money(
      BigInt(purchaseRows[0]?.purchases ?? 0n),
      currencyCode,
    );
    const margin = subtract(salesAmount, cogs);
    const marginPercent =
      salesAmount.amountMinor > 0n
        ? (Number(margin.amountMinor) / Number(salesAmount.amountMinor)) * 100
        : 0;
    return {
      salesAmount,
      purchasesAmount,
      periodDiff: subtract(salesAmount, purchasesAmount),
      cogs,
      margin,
      marginPercent,
    };
  }

  // ---------- Конверсия рекомендаций ----------

  async getRecommendations(
    tenantGroupId: string,
    range: DateRange,
  ): Promise<RecommendationsValue> {
    const rows = await this.prisma.$queryRawUnsafe<
      Array<{ created: bigint; realized: bigint }>
    >(
      `SELECT
         COUNT(*)::bigint AS created,
         COUNT(*) FILTER (WHERE realization IS NOT NULL)::bigint AS realized
       FROM car_recommendation
       WHERE tenant_group_id = $1::uuid
         AND created_at >= $2
         AND created_at < $3`,
      tenantGroupId,
      range.from,
      range.to,
    );
    const created = Number(rows[0]?.created ?? 0n);
    const realized = Number(rows[0]?.realized ?? 0n);
    const conversionPercent = created > 0 ? (realized / created) * 100 : 0;
    return { created, realized, conversionPercent };
  }

  /** Активные открытые рекомендации на текущий момент (срез, без сравнения). */
  async getActiveOpenRecommendations(tenantGroupId: string): Promise<number> {
    return this.prisma.carRecommendation.count({
      where: {
        tenantGroupId,
        realization: null,
        OR: [{ expiredAt: null }, { expiredAt: { gt: new Date() } }],
      },
    });
  }

  // ---------- Новые vs постоянные клиенты ----------

  async getClientsMix(
    tenantId: string,
    range: DateRange,
  ): Promise<ClientsMixValue> {
    const rows = await this.prisma.$queryRawUnsafe<
      Array<{ new_count: bigint; returning_count: bigint }>
    >(
      // Новый/постоянный считаем по дате СОЗДАНИЯ заказа (первый визит),
      // а не по дате закрытия — это метрика привлечения клиентов.
      `WITH firsts AS (
         SELECT o.customer_id, MIN(o.created_at) AS first_at
         FROM orders o
         WHERE o.tenant_id = $1::uuid AND o.customer_id IS NOT NULL
         GROUP BY o.customer_id
       ),
       period AS (
         SELECT DISTINCT o.customer_id
         FROM orders o
         WHERE o.tenant_id = $1::uuid AND o.customer_id IS NOT NULL
           AND o.created_at >= $2 AND o.created_at < $3
       )
       SELECT
         COUNT(*) FILTER (WHERE f.first_at >= $2 AND f.first_at < $3)::bigint AS new_count,
         COUNT(*) FILTER (WHERE f.first_at < $2)::bigint AS returning_count
       FROM period p
       JOIN firsts f ON f.customer_id = p.customer_id`,
      tenantId,
      range.from,
      range.to,
    );
    return {
      newCount: Number(rows[0]?.new_count ?? 0n),
      returningCount: Number(rows[0]?.returning_count ?? 0n),
    };
  }

  // ---------- Клиенты: 6 последних месяцев, год к году ----------

  async getMonthlyClientsLast6(
    tenantId: string,
    tz: string,
    now: Date,
  ): Promise<MonthlyClientsPair[]> {
    const z = toZonedParts(now, tz);
    const slots: Array<{ year: number; month: number; isCurrent: boolean }> = [];
    for (let i = 5; i >= 0; i--) {
      const monthZeroBased = z.month - 1 - i;
      const year = z.year + Math.floor(monthZeroBased / 12);
      const month = ((monthZeroBased % 12) + 12) % 12 + 1;
      slots.push({ year, month, isCurrent: i === 0 });
    }

    const ranges = slots.map((s) =>
      calcMonthYoyRanges(s.year, s.month, s.isCurrent, now, tz),
    );

    const flat = ranges.flatMap((r) => [r.current, r.previous]);
    const values = await Promise.all(
      flat.map((r) => this.getClientsMix(tenantId, r)),
    );

    return slots.map((slot, idx) => ({
      year: slot.year,
      month: slot.month,
      isCurrent: slot.isCurrent,
      current: values[idx * 2]!,
      previous: values[idx * 2 + 1]!,
    }));
  }

  // ---------- Выручка на нормо-час механика (14 полных дней без сегодня: 7 + 7) ----------

  async getMechanicHourRevenue(
    tenantId: string,
    tz: string,
    now: Date,
    workDayMinutes: number,
    currencyCode: string,
  ): Promise<MechanicHourRevenue> {
    const todayStart = startOfDay(now, tz);
    // Берём 14 ПОЛНЫХ прошедших дней, исключая сегодняшний (неполный) день,
    // иначе текущий день занижает среднее. allDays[0] = 14 дней назад, последний = вчера.
    const allDays: Date[] = [];
    for (let i = 14; i >= 1; i--) {
      allDays.push(new Date(todayStart.getTime() - i * DAY_MS));
    }

    const periodStart = allDays[0]!;
    const periodEnd = todayStart;

    const [revenueByKey, mechanicsByKey] = await Promise.all([
      this.getDailyRevenueMap(tenantId, tz, periodStart, periodEnd),
      this.getMechanicsPerDay(tenantId, tz, now),
    ]);

    const safeMinutes = workDayMinutes > 0 ? workDayMinutes : 60;

    const days: Date[] = [];
    const perHourMinor: bigint[] = [];
    const mechanicsInShift: number[] = [];
    for (const d of allDays) {
      const key = zonedDayKey(d, tz);
      const rev = revenueByKey.get(key);
      const dayRevenue = (rev?.works ?? 0n) + (rev?.parts ?? 0n);
      const mechanics = mechanicsByKey.get(key) ?? 0;
      // perHour = revenue / (mechanics * minutes/60) = revenue*60 / (mechanics*minutes)
      const denom = BigInt(mechanics * safeMinutes);
      const perHour = denom > 0n ? (dayRevenue * 60n) / denom : 0n;
      days.push(d);
      perHourMinor.push(perHour);
      mechanicsInShift.push(mechanics);
    }

    const avgMinor = (vals: bigint[]): bigint => {
      if (vals.length === 0) return 0n;
      const sum = vals.reduce<bigint>((a, b) => a + b, 0n);
      return sum / BigInt(vals.length);
    };
    const avgPrev7d = this.money(avgMinor(perHourMinor.slice(0, 7)), currencyCode);
    const avgCurrent = this.money(avgMinor(perHourMinor.slice(7)), currencyCode);

    return {
      days: days.slice(7),
      revenuePerHour: perHourMinor
        .slice(7)
        .map((v) => this.money(v, currencyCode)),
      mechanicsInShift: mechanicsInShift.slice(7),
      workHoursPerDay: safeMinutes / 60,
      avgCurrent,
      avgPrev7d,
    };
  }

  /**
   * Кол-во механиков с назначенными записями в календаре по дням (DISTINCT worker_id).
   * Запись = последняя версия schedule/order_info, не удалённая.
   */
  private async getMechanicsPerDay(
    tenantId: string,
    tz: string,
    now: Date,
  ): Promise<Map<string, number>> {
    // Наивные границы окна (timestamp без TZ в calendar_entry_schedule), как в CalendarService.
    // 14 полных прошедших дней, исключая сегодняшний: [day-14 .. day).
    const z = toZonedParts(now, tz);
    const windowStart = new Date(
      Date.UTC(z.year, z.month - 1, z.day - 14, 0, 0, 0),
    );
    const windowEnd = new Date(Date.UTC(z.year, z.month - 1, z.day, 0, 0, 0));

    const rows = await this.prisma.$queryRawUnsafe<
      Array<{ day_start: Date; mechanics: bigint }>
    >(
      `SELECT
         date_trunc('day', latest_schedule.date)::timestamp AS day_start,
         COUNT(DISTINCT latest_info.worker_id)::bigint AS mechanics
       FROM calendar_entry ce
       JOIN LATERAL (
         SELECT s.date FROM calendar_entry_schedule s
         WHERE s.entry_id = ce.id ORDER BY s.id DESC LIMIT 1
       ) latest_schedule ON TRUE
       JOIN LATERAL (
         SELECT oi.worker_id FROM calendar_entry_order_info oi
         WHERE oi.entry_id = ce.id ORDER BY oi.id DESC LIMIT 1
       ) latest_info ON TRUE
       LEFT JOIN calendar_entry_deletion ced ON ced.entry_id = ce.id
       WHERE ce.tenant_id = $1::uuid
         AND ced.id IS NULL
         AND latest_info.worker_id IS NOT NULL
         AND latest_schedule.date >= $2
         AND latest_schedule.date < $3
       GROUP BY day_start`,
      tenantId,
      windowStart,
      windowEnd,
    );

    const byKey = new Map<string, number>();
    for (const r of rows) {
      byKey.set(dayKey(r.day_start), Number(r.mechanics));
    }
    return byKey;
  }
}
