import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { SettingsService } from 'src/modules/settings/settings.service';
import { OrderStatus } from 'src/modules/order/enums/order-status.enum';
import {
  TaskStatusEnum,
  TaskTypeEnum,
} from 'src/modules/tasks/enums/task.enums';
import type { AuthContext } from 'src/common/user-id.store';
import {
  DashboardSummaryModel,
  EmployeeDebtModel,
  EmployeeDebtSummaryModel,
  IncomeLast7DaysModel,
  MonthlyRevenuePairModel,
  OperationsKpiModel,
  RevenueBreakdownModel,
  WalletBalanceModel,
  DailyRevenueModel,
  WarrantyLast30DaysModel,
  WarrantyOrderModel,
} from './models/dashboard.models';

interface DateRange {
  from: Date;
  to: Date;
}

const DAY_MS = 24 * 60 * 60 * 1000;

interface ZonedParts {
  year: number;
  month: number; // 1-12
  day: number; // 1-31
  hours: number;
  minutes: number;
  seconds: number;
  weekday: number; // 1=Mon ... 7=Sun
}

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settingsService: SettingsService,
  ) {}

  async getSummary(
    ctx: AuthContext,
    overrideTz?: string | null,
  ): Promise<DashboardSummaryModel> {
    const tz =
      overrideTz ?? (await this.settingsService.getTimezone(ctx.tenantId));
    const now = new Date();

    // Балансы — только счета с showInLayout (как настроено в Settings).
    // Приход за 7 дней — все счета тенанта (фильтрация по факту прихода — внутри метода).
    const [walletsForBalances, allWallets] = await Promise.all([
      this.prisma.wallet.findMany({
        where: { tenantId: ctx.tenantId, showInLayout: true },
        orderBy: { name: 'asc' },
        select: { id: true, name: true, currencyCode: true, balance: true },
      }),
      this.prisma.wallet.findMany({
        where: { tenantId: ctx.tenantId },
        orderBy: { name: 'asc' },
        select: { id: true, name: true, currencyCode: true },
      }),
    ]);

    const [
      incomeLast7Days,
      revenueLast7Days,
      employeeDebts,
      operations,
      monthlyRevenue,
      warrantyLast30Days,
    ] = await Promise.all([
      this.getIncomeLast7Days(ctx, allWallets, tz, now),
      this.getRevenueLast7Days(ctx, tz, now),
      this.getEmployeeDebts(ctx),
      this.getOperationsKpi(ctx),
      this.getMonthlyRevenueLast6(ctx, tz, now),
      this.getWarrantyLast30Days(ctx, now),
    ]);

    const walletBalances: WalletBalanceModel[] = walletsForBalances.map((w) => ({
      walletId: w.id,
      walletName: w.name,
      currencyCode: w.currencyCode,
      // wallet.balance хранится как Decimal в минорных единицах (копейки) — конвертим в BigInt без потерь.
      balance: BigInt(w.balance.toFixed(0)),
    }));

    return {
      incomeLast7Days,
      revenueLast7Days,
      walletBalances,
      employeeDebts,
      operations,
      monthlyRevenue,
      warrantyLast30Days,
    };
  }

  // ---------- Income by wallet за 7 дней ----------

  private async getIncomeLast7Days(
    ctx: AuthContext,
    wallets: Array<{ id: string; name: string; currencyCode: string | null }>,
    tz: string,
    now: Date,
  ): Promise<IncomeLast7DaysModel> {
    const days: Date[] = [];
    const todayStart = this.startOfDay(now, tz);
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
      ctx.tenantId,
      walletIds,
      periodStart,
      periodEnd,
    );

    // Матрица [walletId][dayKey] = income
    const byWallet = new Map<string, Map<string, bigint>>();
    for (const w of wallets) byWallet.set(w.id, new Map());
    for (const r of rows) {
      const key = this.dayKey(r.day_start);
      const m = byWallet.get(r.wallet_id);
      if (m) m.set(key, BigInt(r.income));
    }

    const series = wallets
      .map((w) => {
        const map = byWallet.get(w.id) ?? new Map<string, bigint>();
        const amounts = days.map((d) => {
          const parts = this.toZonedParts(d, tz);
          const key = `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`;
          return map.get(key) ?? 0n;
        });
        const total = amounts.reduce<bigint>((a, b) => a + b, 0n);
        return {
          walletId: w.id,
          walletName: w.name,
          currencyCode: w.currencyCode,
          amounts,
          total,
        };
      })
      .filter((s) => s.total > 0n)
      .sort((a, b) => (a.total > b.total ? -1 : a.total < b.total ? 1 : 0))
      .map(({ total: _t, ...rest }) => rest);

    return { days, series };
  }

  // ---------- Revenue last 7 days (accrued, разбивка works/parts) ----------

  private async getRevenueLast7Days(
    ctx: AuthContext,
    tz: string,
    now: Date,
  ): Promise<DailyRevenueModel[]> {
    const days: Date[] = [];
    const todayStart = this.startOfDay(now, tz);
    for (let i = 6; i >= 0; i--) {
      days.push(new Date(todayStart.getTime() - i * DAY_MS));
    }

    const periodStart = days[0]!;
    const periodEnd = new Date(todayStart.getTime() + DAY_MS);

    // Accrued выручка из закрытых сделкой заказов, агрегированная по дням локальной TZ.
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
      ctx.tenantId,
      periodStart,
      periodEnd,
    );

    const byKey = new Map<string, { works: bigint; parts: bigint }>();
    for (const r of rows) {
      const key = this.dayKey(r.day_start);
      byKey.set(key, { works: BigInt(r.works), parts: BigInt(r.parts) });
    }

    return days.map((d) => {
      const parts = this.toZonedParts(d, tz);
      const key = `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`;
      const row = byKey.get(key);
      const works = row?.works ?? 0n;
      const partsAmount = row?.parts ?? 0n;
      return {
        day: d,
        works,
        parts: partsAmount,
        total: works + partsAmount,
      };
    });
  }

  // ---------- Employee debts ----------

  private async getEmployeeDebts(
    ctx: AuthContext,
  ): Promise<EmployeeDebtSummaryModel> {
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
      ctx.tenantId,
    );

    const items: EmployeeDebtModel[] = rows.map((r) => ({
      employeeId: r.employee_id,
      personId: r.person_id,
      fullName: r.full_name || 'Без имени',
      balance: BigInt(r.balance),
    }));

    let totalOwedToEmployees = 0n;
    let totalOwedByEmployees = 0n;
    for (const item of items) {
      if (item.balance > 0n) totalOwedToEmployees += item.balance;
      else if (item.balance < 0n) totalOwedByEmployees += -item.balance;
    }

    return { items, totalOwedToEmployees, totalOwedByEmployees };
  }

  // ---------- Operations KPI ----------

  private async getOperationsKpi(ctx: AuthContext): Promise<OperationsKpiModel> {
    const [activeOrders, readyOrders, qualityControlTasks, openTasks] =
      await Promise.all([
        this.prisma.order.count({
          where: {
            tenantId: ctx.tenantId,
            status: {
              notIn: [OrderStatus.CLOSED, OrderStatus.CANCELLED],
            },
          },
        }),
        this.prisma.order.count({
          where: { tenantId: ctx.tenantId, status: OrderStatus.READY },
        }),
        this.prisma.task.count({
          where: {
            tenantId: ctx.tenantId,
            type: TaskTypeEnum.QUALITY_CONTROL,
            status: { in: [TaskStatusEnum.TODO, TaskStatusEnum.IN_PROGRESS] },
          },
        }),
        this.prisma.task.count({
          where: {
            tenantId: ctx.tenantId,
            status: { in: [TaskStatusEnum.TODO, TaskStatusEnum.IN_PROGRESS] },
          },
        }),
      ]);

    return { activeOrders, readyOrders, qualityControlTasks, openTasks };
  }

  // ---------- Warranty за 30 дней: список заказов + итоги ----------

  private async getWarrantyLast30Days(
    ctx: AuthContext,
    now: Date,
  ): Promise<WarrantyLast30DaysModel> {
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
      ctx.tenantId,
      periodStart,
      now,
    );

    const orders: WarrantyOrderModel[] = rows.map((r) => {
      const works = BigInt(r.works);
      const parts = BigInt(r.parts);
      return {
        orderId: r.order_id,
        orderNumber: r.order_number,
        closedAt: r.closed_at,
        customerName: r.customer_name,
        carName: r.car_name,
        works,
        parts,
        total: works + parts,
      };
    });

    let totalWorks = 0n;
    let totalParts = 0n;
    for (const o of orders) {
      totalWorks += o.works;
      totalParts += o.parts;
    }
    return {
      total: totalWorks + totalParts,
      totalWorks,
      totalParts,
      orders,
    };
  }

  // ---------- Monthly revenue: 6 последних месяцев, год к году ----------

  private async getMonthlyRevenueLast6(
    ctx: AuthContext,
    tz: string,
    now: Date,
  ): Promise<MonthlyRevenuePairModel[]> {
    const z = this.toZonedParts(now, tz);
    const slots: Array<{ year: number; month: number; isCurrent: boolean }> = [];
    for (let i = 5; i >= 0; i--) {
      const monthZeroBased = z.month - 1 - i; // может быть отрицательным
      const year = z.year + Math.floor(monthZeroBased / 12);
      const month = ((monthZeroBased % 12) + 12) % 12 + 1;
      slots.push({ year, month, isCurrent: i === 0 });
    }

    const ranges = slots.map((s) =>
      this.calcMonthYoyRanges(s.year, s.month, s.isCurrent, now, tz),
    );

    const flat = ranges.flatMap((r) => [r.current, r.previous]);
    const revenues = await Promise.all(flat.map((r) => this.calcRevenue(ctx, r)));

    return slots.map((slot, idx) => ({
      year: slot.year,
      month: slot.month,
      isCurrent: slot.isCurrent,
      current: revenues[idx * 2]!,
      previous: revenues[idx * 2 + 1]!,
    }));
  }

  /**
   * Для месяца (year, month) возвращает диапазоны:
   * - current: полный месяц этого года, для текущего месяца — обрезается на now
   * - previous: тот же месяц прошлого года; для текущего — обрезается на (now - 1 год) с учётом длины месяца
   */
  private calcMonthYoyRanges(
    year: number,
    month: number,
    isCurrent: boolean,
    now: Date,
    tz: string,
  ): { current: DateRange; previous: DateRange } {
    const startCur = this.zonedToUtc(year, month, 1, 0, 0, 0, tz);
    const startPrevYear = this.zonedToUtc(year - 1, month, 1, 0, 0, 0, tz);

    const daysInCur = this.daysInMonth(year, month);
    const daysInPrev = this.daysInMonth(year - 1, month);

    const endCurFull = this.zonedToUtc(year, month, daysInCur, 23, 59, 59, tz);
    const endPrevFull = this.zonedToUtc(
      year - 1,
      month,
      daysInPrev,
      23,
      59,
      59,
      tz,
    );

    if (!isCurrent) {
      return {
        current: { from: startCur, to: this.addMs(endCurFull, 1000) },
        previous: { from: startPrevYear, to: this.addMs(endPrevFull, 1000) },
      };
    }

    // Текущий месяц: current до now, previous — тот же кусок прошлого года.
    const z = this.toZonedParts(now, tz);
    const currentEnd = now;
    const targetDay = Math.min(z.day, daysInPrev);
    const previousEnd = this.zonedToUtc(
      year - 1,
      month,
      targetDay,
      z.hours,
      z.minutes,
      z.seconds,
      tz,
    );
    return {
      current: { from: startCur, to: currentEnd },
      previous: { from: startPrevYear, to: previousEnd },
    };
  }

  private addMs(d: Date, ms: number): Date {
    return new Date(d.getTime() + ms);
  }

  private async calcRevenue(
    ctx: AuthContext,
    range: DateRange,
  ): Promise<RevenueBreakdownModel> {
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
      ctx.tenantId,
      range.from,
      range.to,
    );
    const row = rows[0] ?? { works: 0n, parts: 0n };
    const works = BigInt(row.works);
    const parts = BigInt(row.parts);
    return { works, parts, total: works + parts };
  }

  // ---------- Helpers ----------

  /**
   * Получить компоненты даты в указанной зоне (год/месяц/день/часы/минуты/сек/день недели).
   */
  private toZonedParts(date: Date, tz: string): ZonedParts {
    const fmt = new Intl.DateTimeFormat('en-GB', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
      weekday: 'short',
    });
    const parts = fmt.formatToParts(date);
    const get = (type: string) =>
      parts.find((p) => p.type === type)?.value ?? '0';
    const weekdayName = get('weekday');
    const weekdayMap: Record<string, number> = {
      Mon: 1,
      Tue: 2,
      Wed: 3,
      Thu: 4,
      Fri: 5,
      Sat: 6,
      Sun: 7,
    };
    return {
      year: Number(get('year')),
      month: Number(get('month')),
      day: Number(get('day')),
      hours: Number(get('hour') === '24' ? '0' : get('hour')),
      minutes: Number(get('minute')),
      seconds: Number(get('second')),
      weekday: weekdayMap[weekdayName] ?? 1,
    };
  }

  /**
   * Конвертирует "локальное" время в указанной зоне в абсолютную UTC-дату.
   * Алгоритм: строим naive UTC из компонентов, вычисляем смещение TZ для этого момента, корректируем.
   */
  private zonedToUtc(
    year: number,
    month1: number,
    day: number,
    hours: number,
    minutes: number,
    seconds: number,
    tz: string,
  ): Date {
    const naive = Date.UTC(year, month1 - 1, day, hours, minutes, seconds);
    const naiveDate = new Date(naive);
    const z = this.toZonedParts(naiveDate, tz);
    const localOfNaive = Date.UTC(
      z.year,
      z.month - 1,
      z.day,
      z.hours,
      z.minutes,
      z.seconds,
    );
    const offsetMs = localOfNaive - naive;
    return new Date(naive - offsetMs);
  }

  private startOfDay(date: Date, tz: string): Date {
    const z = this.toZonedParts(date, tz);
    return this.zonedToUtc(z.year, z.month, z.day, 0, 0, 0, tz);
  }

  private addDays(date: Date, days: number): Date {
    return new Date(date.getTime() + days * DAY_MS);
  }

  private daysInMonth(year: number, month1: number): number {
    return new Date(Date.UTC(year, month1, 0)).getUTCDate();
  }

  /** Y-M-D ключ из локальной даты (полученной без TZ из date_trunc). */
  private dayKey(d: Date): string {
    // d — локальная дата без TZ, читаем как UTC
    const year = d.getUTCFullYear();
    const month = d.getUTCMonth() + 1;
    const day = d.getUTCDate();
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }
}
