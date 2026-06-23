import type { Money } from 'src/common/money/money.types';

/**
 * Доменные типы для аналитических расчётов. Без GraphQL-декораторов —
 * это переиспользуемые результаты математики, которые модули (Dashboard и др.)
 * маппят в свои presentation-модели.
 *
 * Все денежные величины — Money (сумма в минорных единицах + валюта).
 * Сырой bigint используется только как вспомогательный элемент внутри Money.
 */

/** Обёртка для сравнительного анализа: текущий период vs MoM/YoY. */
export interface Comparative<T> {
  current: T;
  momPrevious: T;
  yoyPrevious: T;
}

export interface RevenueBreakdown {
  works: Money;
  parts: Money;
  total: Money;
}

export interface OpenOrdersTotals {
  works: Money;
  parts: Money;
  total: Money;
  ordersCount: number;
}

export interface DailyRevenue {
  day: Date;
  works: Money;
  parts: Money;
  total: Money;
}

export interface WalletIncomeSeries {
  walletId: string;
  walletName: string;
  /** Приход по дням (валюта счёта внутри каждого Money). */
  amounts: Money[];
}

export interface IncomeLast7Days {
  days: Date[];
  series: WalletIncomeSeries[];
}

export interface WalletBalance {
  walletId: string;
  walletName: string;
  /** Баланс счёта (валюта счёта внутри Money; при отсутствии — дефолт тенанта). */
  balance: Money;
}

export interface EmployeeDebt {
  employeeId: string;
  personId: string;
  fullName: string;
  balance: Money;
}

export interface EmployeeDebtSummary {
  items: EmployeeDebt[];
  totalOwedToEmployees: Money;
  totalOwedByEmployees: Money;
}

export interface OperationsKpi {
  activeOrders: number;
  readyOrders: number;
  qualityControlTasks: number;
  openTasks: number;
}

export interface MonthlyRevenuePair {
  year: number;
  month: number;
  isCurrent: boolean;
  current: RevenueBreakdown;
  previous: RevenueBreakdown;
}

export interface WarrantyOrder {
  orderId: string;
  orderNumber: number;
  closedAt: Date;
  customerName: string | null;
  carName: string | null;
  works: Money;
  parts: Money;
  total: Money;
}

export interface WarrantyLast30Days {
  total: Money;
  totalWorks: Money;
  totalParts: Money;
  orders: WarrantyOrder[];
}

// ---- Новые метрики ----

export interface AvgCheckValue {
  avgCheck: Money;
  revenueTotal: Money;
  ordersCount: number;
}

export interface PartsMarginValue {
  /** Выручка по проданным запчастям (без warranty). */
  salesAmount: Money;
  /** Сумма закупок (income_part) за период. */
  purchasesAmount: Money;
  /** salesAmount - purchasesAmount (грубая маржа за период). */
  periodDiff: Money;
  /** Себестоимость проданных запчастей (point-in-time, последняя закупка <= закрытия). */
  cogs: Money;
  /** salesAmount - cogs. */
  margin: Money;
  /** margin / salesAmount * 100 (0, если продаж нет). */
  marginPercent: number;
}

export interface RecommendationsValue {
  created: number;
  realized: number;
  conversionPercent: number;
}

export interface ClientsMixValue {
  newCount: number;
  returningCount: number;
}

export interface MonthlyClientsPair {
  year: number;
  month: number;
  isCurrent: boolean;
  current: ClientsMixValue;
  previous: ClientsMixValue;
}

export interface MechanicHourRevenue {
  days: Date[];
  revenuePerHour: Money[];
  mechanicsInShift: number[];
  workHoursPerDay: number;
  /** Среднее revenuePerHour за последние 7 дней. */
  avgCurrent: Money;
  /** Среднее revenuePerHour за предыдущие 7 дней. */
  avgPrev7d: Money;
}
