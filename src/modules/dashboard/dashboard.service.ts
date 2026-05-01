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
  DateRangeModel,
  EmployeeDebtModel,
  EmployeeDebtSummaryModel,
  OperationsKpiModel,
  PeriodComparisonModel,
  PeriodPairModel,
  RevenueBreakdownModel,
  WalletBalanceModel,
  WalletDailyAmountModel,
  DailyAmountModel,
} from './models/dashboard.models';

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

    const wallets = await this.prisma.wallet.findMany({
      where: { tenantId: ctx.tenantId, showInLayout: true },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        currencyCode: true,
        balance: true,
      },
    });
    const walletIds = wallets.map((w) => w.id);

    const [
      todayIncomeByWallet,
      revenueLast7Days,
      employeeDebts,
      operations,
      periodComparison,
    ] = await Promise.all([
      this.getTodayIncomeByWallet(ctx, wallets, tz, now),
      this.getRevenueLast7Days(ctx, walletIds, tz, now),
      this.getEmployeeDebts(ctx),
      this.getOperationsKpi(ctx),
      this.getPeriodComparison(ctx, tz, now),
    ]);

    const walletBalances: WalletBalanceModel[] = wallets.map((w) => ({
      walletId: w.id,
      walletName: w.name,
      currencyCode: w.currencyCode,
      // wallet.balance хранится как Decimal в минорных единицах (копейки) — конвертим в BigInt без потерь.
      balance: BigInt(w.balance.toFixed(0)),
    }));

    return {
      todayIncomeByWallet,
      revenueLast7Days,
      walletBalances,
      employeeDebts,
      operations,
      periodComparison,
    };
  }

  // ---------- Today's income by wallet (bar) ----------

  private async getTodayIncomeByWallet(
    ctx: AuthContext,
    wallets: Array<{ id: string; name: string; currencyCode: string | null }>,
    tz: string,
    now: Date,
  ): Promise<WalletDailyAmountModel[]> {
    if (wallets.length === 0) return [];
    const dayStart = this.startOfDay(now, tz);
    const dayEnd = new Date(dayStart.getTime() + DAY_MS);

    const grouped = await this.prisma.walletTransaction.groupBy({
      by: ['walletId'],
      where: {
        tenantId: ctx.tenantId,
        walletId: { in: wallets.map((w) => w.id) },
        createdAt: { gte: dayStart, lt: dayEnd },
        amountAmount: { gt: 0 },
      },
      _sum: { amountAmount: true },
    });

    const sumByWallet = new Map<string, bigint>(
      grouped.map((g) => [g.walletId, g._sum.amountAmount ?? 0n]),
    );

    return wallets.map((w) => ({
      walletId: w.id,
      walletName: w.name,
      currencyCode: w.currencyCode,
      amountIncome: sumByWallet.get(w.id) ?? 0n,
    }));
  }

  // ---------- Revenue last 7 days (line) ----------

  private async getRevenueLast7Days(
    ctx: AuthContext,
    walletIds: string[],
    tz: string,
    now: Date,
  ): Promise<DailyAmountModel[]> {
    const days: Date[] = [];
    const todayStart = this.startOfDay(now, tz);
    for (let i = 6; i >= 0; i--) {
      days.push(new Date(todayStart.getTime() - i * DAY_MS));
    }
    if (walletIds.length === 0) {
      return days.map((d) => ({ day: d, income: 0n, expense: 0n }));
    }

    const periodStart = days[0]!;
    const periodEnd = new Date(todayStart.getTime() + DAY_MS);

    // Группировка по дню (в нужной TZ) — raw SQL.
    const rows = await this.prisma.$queryRawUnsafe<
      Array<{ day_start: Date; income: bigint; expense: bigint }>
    >(
      `SELECT
         date_trunc('day', (created_at AT TIME ZONE $1))::timestamp AS day_start,
         COALESCE(SUM(CASE WHEN amount_amount > 0 THEN amount_amount ELSE 0 END), 0)::bigint AS income,
         COALESCE(SUM(CASE WHEN amount_amount < 0 THEN -amount_amount ELSE 0 END), 0)::bigint AS expense
       FROM wallet_transaction
       WHERE tenant_id = $2::uuid
         AND wallet_id = ANY($3::uuid[])
         AND created_at >= $4
         AND created_at < $5
       GROUP BY day_start
       ORDER BY day_start`,
      tz,
      ctx.tenantId,
      walletIds,
      periodStart,
      periodEnd,
    );

    // SQL вернул day_start как локальное (без TZ) — приведём обратно к UTC момент начала дня в TZ.
    // Для маппинга используем строку YYYY-MM-DD как ключ.
    const byKey = new Map<string, { income: bigint; expense: bigint }>();
    for (const r of rows) {
      // r.day_start — это уже локальная дата (без TZ), берём её Y-M-D
      const key = this.dayKey(r.day_start);
      byKey.set(key, { income: BigInt(r.income), expense: BigInt(r.expense) });
    }

    return days.map((d) => {
      const parts = this.toZonedParts(d, tz);
      const key = `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`;
      const row = byKey.get(key);
      return {
        day: d,
        income: row?.income ?? 0n,
        expense: row?.expense ?? 0n,
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

  // ---------- Period comparison (MTD / WTD vs прошлый эквивалент) ----------

  private async getPeriodComparison(
    ctx: AuthContext,
    tz: string,
    now: Date,
  ): Promise<PeriodComparisonModel> {
    const monthRanges = this.calcMonthRanges(now, tz);
    const weekRanges = this.calcWeekRanges(now, tz);

    const [monthCur, monthPrev, weekCur, weekPrev] = await Promise.all([
      this.calcRevenue(ctx, monthRanges.current),
      this.calcRevenue(ctx, monthRanges.previous),
      this.calcRevenue(ctx, weekRanges.current),
      this.calcRevenue(ctx, weekRanges.previous),
    ]);

    const monthToDate: PeriodPairModel = {
      current: monthCur,
      previous: monthPrev,
      currentRange: monthRanges.current,
      previousRange: monthRanges.previous,
    };
    const weekToDate: PeriodPairModel = {
      current: weekCur,
      previous: weekPrev,
      currentRange: weekRanges.current,
      previousRange: weekRanges.previous,
    };

    return { monthToDate, weekToDate };
  }

  private async calcRevenue(
    ctx: AuthContext,
    range: DateRangeModel,
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

  private calcMonthRanges(
    now: Date,
    tz: string,
  ): { current: DateRangeModel; previous: DateRangeModel } {
    const z = this.toZonedParts(now, tz);
    const curStart = this.zonedToUtc(z.year, z.month, 1, 0, 0, 0, tz);
    const curEnd = now;

    const prevYear = z.month === 1 ? z.year - 1 : z.year;
    const prevMonth = z.month === 1 ? 12 : z.month - 1;
    const daysInCur = this.daysInMonth(z.year, z.month);
    const daysInPrev = this.daysInMonth(prevYear, prevMonth);

    const prevStart = this.zonedToUtc(prevYear, prevMonth, 1, 0, 0, 0, tz);
    let prevEnd: Date;
    if (z.day === daysInCur) {
      // Сегодня — последний день текущего месяца → берём полный прошлый месяц.
      prevEnd = this.zonedToUtc(z.year, z.month, 1, 0, 0, 0, tz); // начало текущего = end exclusive прошлого
    } else {
      const targetDay = Math.min(z.day, daysInPrev);
      prevEnd = this.zonedToUtc(
        prevYear,
        prevMonth,
        targetDay,
        z.hours,
        z.minutes,
        z.seconds,
        tz,
      );
    }

    return {
      current: { from: curStart, to: curEnd },
      previous: { from: prevStart, to: prevEnd },
    };
  }

  private calcWeekRanges(
    now: Date,
    tz: string,
  ): { current: DateRangeModel; previous: DateRangeModel } {
    const z = this.toZonedParts(now, tz);
    // Понедельник текущей недели (z.weekday: 1=Пн ... 7=Вс)
    const dayOffset = z.weekday - 1;
    const monday = this.addDays(
      this.zonedToUtc(z.year, z.month, z.day, 0, 0, 0, tz),
      -dayOffset,
    );
    const curStart = monday;
    const curEnd = now;
    const prevStart = new Date(curStart.getTime() - 7 * DAY_MS);
    const prevEnd = new Date(curEnd.getTime() - 7 * DAY_MS);
    return {
      current: { from: curStart, to: curEnd },
      previous: { from: prevStart, to: prevEnd },
    };
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
