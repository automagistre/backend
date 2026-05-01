import { Field, ID, ObjectType } from '@nestjs/graphql';

@ObjectType('DashboardWalletIncomeSeries')
export class WalletIncomeSeriesModel {
  @Field(() => ID)
  walletId: string;

  @Field(() => String)
  walletName: string;

  @Field(() => String, { nullable: true })
  currencyCode: string | null;

  @Field(() => [BigInt], {
    description: 'Суммы прихода по дням (порядок соответствует days в IncomeLast7Days)',
  })
  amounts: bigint[];
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

  @Field(() => BigInt, {
    description: 'Выручка по работам за день, accrued из закрытых заказов',
  })
  works: bigint;

  @Field(() => BigInt, {
    description: 'Выручка по запчастям за день',
  })
  parts: bigint;

  @Field(() => BigInt, { description: 'works + parts' })
  total: bigint;
}

@ObjectType('DashboardWalletBalance')
export class WalletBalanceModel {
  @Field(() => ID)
  walletId: string;

  @Field(() => String)
  walletName: string;

  @Field(() => String, { nullable: true })
  currencyCode: string | null;

  @Field(() => BigInt, { description: 'Баланс в минорных единицах' })
  balance: bigint;
}

@ObjectType('DashboardEmployeeDebt')
export class EmployeeDebtModel {
  @Field(() => ID)
  employeeId: string;

  @Field(() => ID)
  personId: string;

  @Field(() => String)
  fullName: string;

  @Field(() => BigInt, {
    description:
      'Баланс сотрудника. Положительный — компания должна сотруднику, отрицательный — сотрудник должен компании.',
  })
  balance: bigint;
}

@ObjectType('DashboardEmployeeDebtSummary')
export class EmployeeDebtSummaryModel {
  @Field(() => [EmployeeDebtModel])
  items: EmployeeDebtModel[];

  @Field(() => BigInt, { description: 'Сумма положительных балансов — мы должны сотрудникам' })
  totalOwedToEmployees: bigint;

  @Field(() => BigInt, { description: 'Сумма отрицательных балансов (как положительное число) — сотрудники должны нам' })
  totalOwedByEmployees: bigint;
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
  @Field(() => BigInt, { description: 'Выручка по работам (без warranty), accrued из закрытых заказов' })
  works: bigint;

  @Field(() => BigInt, { description: 'Выручка по запчастям (без warranty)' })
  parts: bigint;

  @Field(() => BigInt, { description: 'works + parts' })
  total: bigint;
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

  @Field(() => BigInt, { description: 'Гарантийные работы в заказе' })
  works: bigint;

  @Field(() => BigInt, { description: 'Гарантийные запчасти в заказе' })
  parts: bigint;

  @Field(() => BigInt, { description: 'works + parts' })
  total: bigint;
}

@ObjectType('DashboardWarrantyLast30Days')
export class WarrantyLast30DaysModel {
  @Field(() => BigInt, { description: 'Сумма всей гарантии за 30 дней' })
  total: bigint;

  @Field(() => BigInt)
  totalWorks: bigint;

  @Field(() => BigInt)
  totalParts: bigint;

  @Field(() => [WarrantyOrderModel], {
    description: 'Заказы с гарантийными позициями (отсортированы по убыванию суммы)',
  })
  orders: WarrantyOrderModel[];
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
}
