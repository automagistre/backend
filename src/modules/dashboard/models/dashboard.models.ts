import { Field, ID, ObjectType } from '@nestjs/graphql';

@ObjectType('DashboardWalletDailyAmount')
export class WalletDailyAmountModel {
  @Field(() => ID)
  walletId: string;

  @Field(() => String)
  walletName: string;

  @Field(() => String, { nullable: true })
  currencyCode: string | null;

  @Field(() => BigInt, {
    description: 'Сумма прихода (положительные транзакции) за день',
  })
  amountIncome: bigint;
}

@ObjectType('DashboardDailyAmount')
export class DailyAmountModel {
  @Field(() => Date, {
    description: 'День (00:00 локального времени тенанта)',
  })
  day: Date;

  @Field(() => BigInt, {
    description: 'Сумма приходов за день',
  })
  income: bigint;

  @Field(() => BigInt, {
    description: 'Сумма расходов за день (положительное число)',
  })
  expense: bigint;
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

@ObjectType('DashboardDateRange')
export class DateRangeModel {
  @Field(() => Date)
  from: Date;

  @Field(() => Date)
  to: Date;
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

@ObjectType('DashboardPeriodPair')
export class PeriodPairModel {
  @Field(() => RevenueBreakdownModel)
  current: RevenueBreakdownModel;

  @Field(() => RevenueBreakdownModel)
  previous: RevenueBreakdownModel;

  @Field(() => DateRangeModel)
  currentRange: DateRangeModel;

  @Field(() => DateRangeModel)
  previousRange: DateRangeModel;
}

@ObjectType('DashboardPeriodComparison')
export class PeriodComparisonModel {
  @Field(() => PeriodPairModel, { description: 'MTD vs прошлый месяц до того же дня' })
  monthToDate: PeriodPairModel;

  @Field(() => PeriodPairModel, { description: 'WTD vs прошлая неделя со сдвигом 7 дней' })
  weekToDate: PeriodPairModel;
}

@ObjectType('DashboardSummary')
export class DashboardSummaryModel {
  @Field(() => [WalletDailyAmountModel])
  todayIncomeByWallet: WalletDailyAmountModel[];

  @Field(() => [DailyAmountModel])
  revenueLast7Days: DailyAmountModel[];

  @Field(() => [WalletBalanceModel])
  walletBalances: WalletBalanceModel[];

  @Field(() => EmployeeDebtSummaryModel)
  employeeDebts: EmployeeDebtSummaryModel;

  @Field(() => PeriodComparisonModel)
  periodComparison: PeriodComparisonModel;

  @Field(() => OperationsKpiModel)
  operations: OperationsKpiModel;
}
