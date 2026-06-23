import { Field, Float, ID, Int, ObjectType } from '@nestjs/graphql';
import { MoneyModel } from 'src/common/models/money.model';

@ObjectType('DashboardWalletIncomeSeries')
export class WalletIncomeSeriesModel {
  @Field(() => ID)
  walletId: string;

  @Field(() => String)
  walletName: string;

  @Field(() => [MoneyModel], {
    description: 'Суммы прихода по дням (порядок соответствует days в IncomeLast7Days)',
  })
  amounts: MoneyModel[];
}

@ObjectType('DashboardIncomeLast7Days')
export class IncomeLast7DaysModel {
  @Field(() => [Date], {
    description: '7 дней (00:00 локального времени тенанта), от старого к новому',
  })
  days: Date[];

  @Field(() => [WalletIncomeSeriesModel], {
    description: 'Серии по счетам (только showInLayout=true)',
  })
  series: WalletIncomeSeriesModel[];
}

@ObjectType('DashboardDailyRevenue')
export class DailyRevenueModel {
  @Field(() => Date, {
    description: 'День (00:00 локального времени тенанта)',
  })
  day: Date;

  @Field(() => MoneyModel, {
    description: 'Выручка по работам за день, accrued из закрытых заказов',
  })
  works: MoneyModel;

  @Field(() => MoneyModel, {
    description: 'Выручка по запчастям за день',
  })
  parts: MoneyModel;

  @Field(() => MoneyModel, { description: 'works + parts' })
  total: MoneyModel;
}

@ObjectType('DashboardWalletBalance')
export class WalletBalanceModel {
  @Field(() => ID)
  walletId: string;

  @Field(() => String)
  walletName: string;

  @Field(() => MoneyModel, { description: 'Баланс счёта (сумма + валюта)' })
  balance: MoneyModel;
}

@ObjectType('DashboardEmployeeDebt')
export class EmployeeDebtModel {
  @Field(() => ID)
  employeeId: string;

  @Field(() => ID)
  personId: string;

  @Field(() => String)
  fullName: string;

  @Field(() => MoneyModel, {
    description:
      'Баланс сотрудника. Положительный — компания должна сотруднику, отрицательный — сотрудник должен компании.',
  })
  balance: MoneyModel;
}

@ObjectType('DashboardEmployeeDebtSummary')
export class EmployeeDebtSummaryModel {
  @Field(() => [EmployeeDebtModel])
  items: EmployeeDebtModel[];

  @Field(() => MoneyModel, { description: 'Сумма положительных балансов — мы должны сотрудникам' })
  totalOwedToEmployees: MoneyModel;

  @Field(() => MoneyModel, { description: 'Сумма отрицательных балансов (как положительное число) — сотрудники должны нам' })
  totalOwedByEmployees: MoneyModel;
}

@ObjectType('DashboardOperationsKpi')
export class OperationsKpiModel {
  @Field(() => Number, { description: 'Активные заказы (не закрытые и не отменённые)' })
  activeOrders: number;

  @Field(() => Number, { description: 'Заказы готовые к выдаче (status = READY)' })
  readyOrders: number;

  @Field(() => Number, { description: 'Открытые задачи QUALITY_CONTROL (TODO + IN_PROGRESS)' })
  qualityControlTasks: number;

  @Field(() => Number, { description: 'Все открытые задачи (TODO + IN_PROGRESS)' })
  openTasks: number;
}

@ObjectType('DashboardRevenueBreakdown')
export class RevenueBreakdownModel {
  @Field(() => MoneyModel, { description: 'Выручка по работам (без warranty), accrued из закрытых заказов' })
  works: MoneyModel;

  @Field(() => MoneyModel, { description: 'Выручка по запчастям (без warranty)' })
  parts: MoneyModel;

  @Field(() => MoneyModel, { description: 'works + parts' })
  total: MoneyModel;
}

@ObjectType('DashboardMonthlyRevenuePair')
export class MonthlyRevenuePairModel {
  @Field(() => Number, { description: 'Год текущего слота (например 2026)' })
  year: number;

  @Field(() => Number, { description: 'Месяц 1..12' })
  month: number;

  @Field(() => Boolean, {
    description:
      'Является ли месяц текущим (тогда current и previous посчитаны MTD)',
  })
  isCurrent: boolean;

  @Field(() => RevenueBreakdownModel, {
    description: 'Выручка за этот месяц текущего года',
  })
  current: RevenueBreakdownModel;

  @Field(() => RevenueBreakdownModel, {
    description: 'Выручка за тот же месяц прошлого года (тот же интервал для текущего месяца)',
  })
  previous: RevenueBreakdownModel;
}

@ObjectType('DashboardWarrantyOrder')
export class WarrantyOrderModel {
  @Field(() => ID)
  orderId: string;

  @Field(() => Number)
  orderNumber: number;

  @Field(() => Date)
  closedAt: Date;

  @Field(() => String, { nullable: true })
  customerName: string | null;

  @Field(() => String, { nullable: true })
  carName: string | null;

  @Field(() => MoneyModel, { description: 'Гарантийные работы в заказе' })
  works: MoneyModel;

  @Field(() => MoneyModel, { description: 'Гарантийные запчасти в заказе' })
  parts: MoneyModel;

  @Field(() => MoneyModel, { description: 'works + parts' })
  total: MoneyModel;
}

@ObjectType('DashboardWarrantyLast30Days')
export class WarrantyLast30DaysModel {
  @Field(() => MoneyModel, { description: 'Сумма всей гарантии за 30 дней' })
  total: MoneyModel;

  @Field(() => MoneyModel)
  totalWorks: MoneyModel;

  @Field(() => MoneyModel)
  totalParts: MoneyModel;

  @Field(() => [WarrantyOrderModel], {
    description: 'Заказы с гарантийными позициями (отсортированы по убыванию суммы)',
  })
  orders: WarrantyOrderModel[];
}

@ObjectType('DashboardOpenOrdersTotals')
export class OpenOrdersTotalsModel {
  @Field(() => MoneyModel, {
    description: 'Сумма работ (без warranty) в открытых заказах',
  })
  works: MoneyModel;

  @Field(() => MoneyModel, {
    description: 'Сумма запчастей (без warranty) в открытых заказах',
  })
  parts: MoneyModel;

  @Field(() => MoneyModel, { description: 'works + parts' })
  total: MoneyModel;

  @Field(() => Number, { description: 'Количество открытых заказов' })
  ordersCount: number;
}

// ---------- Средний чек (AOV) ----------

@ObjectType('DashboardAvgCheckValue')
export class AvgCheckValueModel {
  @Field(() => MoneyModel, { description: 'Средний чек (выручка / число закрытых заказов)' })
  avgCheck: MoneyModel;

  @Field(() => MoneyModel, { description: 'Суммарная выручка периода (works + parts, без warranty)' })
  revenueTotal: MoneyModel;

  @Field(() => Int, { description: 'Число закрытых заказов за период' })
  ordersCount: number;
}

@ObjectType('DashboardAvgCheck')
export class AvgCheckModel {
  @Field(() => AvgCheckValueModel, { description: 'Текущий месяц (MTD)' })
  current: AvgCheckValueModel;

  @Field(() => AvgCheckValueModel, { description: 'Предыдущий месяц (тот же день)' })
  momPrevious: AvgCheckValueModel;

  @Field(() => AvgCheckValueModel, { description: 'Тот же месяц прошлого года (тот же день)' })
  yoyPrevious: AvgCheckValueModel;
}

// ---------- Маржа запчастей ----------

@ObjectType('DashboardPartsMarginValue')
export class PartsMarginValueModel {
  @Field(() => MoneyModel, { description: 'Выручка по проданным запчастям (без warranty)' })
  salesAmount: MoneyModel;

  @Field(() => MoneyModel, { description: 'Сумма закупок (income_part) за период' })
  purchasesAmount: MoneyModel;

  @Field(() => MoneyModel, { description: 'salesAmount - purchasesAmount (грубая маржа за период)' })
  periodDiff: MoneyModel;

  @Field(() => MoneyModel, {
    description: 'Себестоимость проданных запчастей (последняя закупка не новее закрытия заказа)',
  })
  cogs: MoneyModel;

  @Field(() => MoneyModel, { description: 'salesAmount - cogs' })
  margin: MoneyModel;

  @Field(() => Float, { description: 'margin / salesAmount * 100' })
  marginPercent: number;
}

@ObjectType('DashboardPartsMargin')
export class PartsMarginModel {
  @Field(() => PartsMarginValueModel)
  current: PartsMarginValueModel;

  @Field(() => PartsMarginValueModel)
  momPrevious: PartsMarginValueModel;

  @Field(() => PartsMarginValueModel)
  yoyPrevious: PartsMarginValueModel;
}

// ---------- Конверсия рекомендаций ----------

@ObjectType('DashboardRecommendationsValue')
export class RecommendationsValueModel {
  @Field(() => Int, { description: 'Создано рекомендаций за период' })
  created: number;

  @Field(() => Int, { description: 'Из них реализовано в заказ' })
  realized: number;

  @Field(() => Float, { description: 'realized / created * 100' })
  conversionPercent: number;
}

@ObjectType('DashboardRecommendations')
export class RecommendationsModel {
  @Field(() => RecommendationsValueModel, {
    description: 'Конверсия рекомендаций за последние 3 месяца',
  })
  current: RecommendationsValueModel;
}

// ---------- Новые vs постоянные клиенты ----------

@ObjectType('DashboardClientsMixValue')
export class ClientsMixValueModel {
  @Field(() => Int, { description: 'Новые клиенты (первый закрытый заказ в периоде)' })
  newCount: number;

  @Field(() => Int, { description: 'Повторные клиенты (закрывали заказ ранее)' })
  returningCount: number;
}

@ObjectType('DashboardMonthlyClientsPair')
export class MonthlyClientsPairModel {
  @Field(() => Number, { description: 'Год слота (например 2026)' })
  year: number;

  @Field(() => Number, { description: 'Месяц 1..12' })
  month: number;

  @Field(() => Boolean, {
    description: 'Является ли месяц текущим (current/previous посчитаны MTD)',
  })
  isCurrent: boolean;

  @Field(() => ClientsMixValueModel, { description: 'Клиенты за месяц текущего года' })
  current: ClientsMixValueModel;

  @Field(() => ClientsMixValueModel, {
    description: 'Клиенты за тот же месяц прошлого года (тот же интервал для текущего месяца)',
  })
  previous: ClientsMixValueModel;
}

// ---------- Выручка на нормо-час механика ----------

@ObjectType('DashboardMechanicHourRevenue')
export class MechanicHourRevenueModel {
  @Field(() => [Date], { description: '7 дней (00:00 локального времени тенанта), от старого к новому' })
  days: Date[];

  @Field(() => [MoneyModel], { description: 'Выручка на нормо-час по дням' })
  revenuePerHour: MoneyModel[];

  @Field(() => [Int], { description: 'Число механиков в смене по дням (DISTINCT из календаря)' })
  mechanicsInShift: number[];

  @Field(() => Float, { description: 'Длина рабочего дня в часах (вычислено из настроек start/end)' })
  workHoursPerDay: number;

  @Field(() => MoneyModel, { description: 'Среднее revenuePerHour за последние 7 дней' })
  avgCurrent: MoneyModel;

  @Field(() => MoneyModel, { description: 'Среднее revenuePerHour за предыдущие 7 дней' })
  avgPrev7d: MoneyModel;
}

@ObjectType('DashboardSummary')
export class DashboardSummaryModel {
  @Field(() => IncomeLast7DaysModel, {
    description: 'Приход по счетам за 7 дней с разбивкой по дням',
  })
  incomeLast7Days: IncomeLast7DaysModel;

  @Field(() => [DailyRevenueModel])
  revenueLast7Days: DailyRevenueModel[];

  @Field(() => [WalletBalanceModel])
  walletBalances: WalletBalanceModel[];

  @Field(() => EmployeeDebtSummaryModel)
  employeeDebts: EmployeeDebtSummaryModel;

  @Field(() => [MonthlyRevenuePairModel], {
    description:
      'Выручка по 6 последним месяцам (включая текущий), для каждого — пара current vs previous (тот же месяц прошлого года)',
  })
  monthlyRevenue: MonthlyRevenuePairModel[];

  @Field(() => WarrantyLast30DaysModel, {
    description: 'Заказы с гарантийными позициями за последние 30 дней',
  })
  warrantyLast30Days: WarrantyLast30DaysModel;

  @Field(() => OperationsKpiModel)
  operations: OperationsKpiModel;

  @Field(() => OpenOrdersTotalsModel, {
    description: 'Сумма работ/запчастей по открытым (не закрытым/отменённым) заказам',
  })
  openOrdersTotals: OpenOrdersTotalsModel;

  @Field(() => AvgCheckModel, { description: 'Средний чек: текущий месяц vs MoM/YoY' })
  avgCheck: AvgCheckModel;

  @Field(() => PartsMarginModel, { description: 'Маржа запчастей: текущий месяц vs MoM/YoY' })
  partsMargin: PartsMarginModel;

  @Field(() => RecommendationsModel, {
    description: 'Конверсия рекомендаций: текущий месяц vs MoM/YoY + активные открытые',
  })
  recommendations: RecommendationsModel;

  @Field(() => [MonthlyClientsPairModel], {
    description:
      'Новые/постоянные клиенты по 6 последним месяцам (включая текущий), пара current vs previous (тот же месяц прошлого года)',
  })
  monthlyClients: MonthlyClientsPairModel[];

  @Field(() => MechanicHourRevenueModel, {
    description: 'Выручка на нормо-час механика: тренд 7 дней + дельта к прошлым 7 дням',
  })
  mechanicHourRevenue: MechanicHourRevenueModel;
}
