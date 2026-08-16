import { registerEnumType } from '@nestjs/graphql';

/** Типы источника проводки по клиенту (операнду). */
export enum CustomerTransactionSource {
  OrderPrepay = 1,
  OrderDebit = 2,
  OrderPayment = 3,
  /** Зарплата по заказу (sourceId = orderId, operandId = personId сотрудника). */
  OrderSalary = 4,
  /** Выдача зарплаты (с кошельком, sourceId = walletTransactionId) */
  Payroll = 5,
  /** Начисление ежемесячного оклада (sourceId = employee_salary.id) */
  MonthlySalary = 8,
  /** Штраф (без счёта, sourceId = userId) */
  Penalty = 9,
  Manual = 10,
  ManualWithoutWallet = 11,
  /**
   * Возврат предоплаты по заказу (sourceId = orderId, operandId = customerId).
   * До разделения source совпадал с OrderSalary (=4), из-за чего идемпотентная
   * проверка начисления ЗП ложно срабатывала и блокировала начисление.
   */
  OrderPrepayRefund = 12,
  /**
   * Удержание за гарантию по вине исполнителя (sourceId = orderItemService.id
   * или orderItemPart.id, operandId = personId сотрудника). Не Penalty —
   * у Penalty другая семантика (sourceId = userId создателя, ручной штраф).
   */
  WarrantyDeduction = 13,
  /**
   * Компенсация ЗП исполнителя с плательщика гарантии, когда плательщик —
   * другой сотрудник (не исполнитель). sourceId = orderItemService.id,
   * operandId = personId плательщика.
   */
  WarrantySalaryCompensation = 14,
  /**
   * Удержание за простой сервиса с плательщика гарантии, когда плательщик —
   * другой сотрудник (не исполнитель). sourceId = orderItemService.id,
   * operandId = personId плательщика.
   */
  WarrantyMarginDeduction = 15,
  /**
   * Доплата до гарантированного минимума ЗП за календарный месяц
   * (sourceId = employee.id, operandId = personId сотрудника).
   * Начисляется 1-го числа следующего месяца cron'ом.
   */
  MinimumWageCompensation = 16,
}

/**
 * Начисления, входящие в «выработку» для расчёта гарантированного минимума.
 * Без MinimumWageCompensation — иначе доплата за прошлый месяц засчитывалась бы
 * в выработку текущего.
 */
export const PRODUCTION_INCOME_SOURCES = [
  CustomerTransactionSource.OrderSalary,
  CustomerTransactionSource.MonthlySalary,
  CustomerTransactionSource.Manual,
  CustomerTransactionSource.ManualWithoutWallet,
] as const;

/** Начисления ЗП: по заказу, оклад, ручные проводки и доплата до минимума. */
export const SALARY_INCOME_SOURCES = [
  ...PRODUCTION_INCOME_SOURCES,
  CustomerTransactionSource.MinimumWageCompensation,
] as const;

/** Удержания из ЗП: штраф и гарантийные пенальти. */
export const SALARY_DEDUCTION_SOURCES = [
  CustomerTransactionSource.Penalty,
  CustomerTransactionSource.WarrantyDeduction,
  CustomerTransactionSource.WarrantySalaryCompensation,
  CustomerTransactionSource.WarrantyMarginDeduction,
] as const;

export const SALARY_NET_SOURCES = [
  ...SALARY_INCOME_SOURCES,
  ...SALARY_DEDUCTION_SOURCES,
] as const;

const LABELS: Record<CustomerTransactionSource, string> = {
  [CustomerTransactionSource.OrderPrepay]: 'Предоплата по заказу',
  [CustomerTransactionSource.OrderDebit]: 'Начисление по заказу',
  [CustomerTransactionSource.OrderPayment]: 'Списание по заказу',
  [CustomerTransactionSource.OrderSalary]: 'Зарплата по заказу',
  [CustomerTransactionSource.Payroll]: 'Выдача зарплаты',
  [CustomerTransactionSource.MonthlySalary]: 'Начисление ежемесячного оклада',
  [CustomerTransactionSource.Penalty]: 'Штраф',
  [CustomerTransactionSource.Manual]: 'Ручная проводка',
  [CustomerTransactionSource.ManualWithoutWallet]:
    'Ручная проводка (без счёта)',
  [CustomerTransactionSource.OrderPrepayRefund]: 'Возврат предоплаты по заказу',
  [CustomerTransactionSource.WarrantyDeduction]: 'Удержание за гарантию',
  [CustomerTransactionSource.WarrantySalaryCompensation]:
    'Компенсация ЗП по гарантии',
  [CustomerTransactionSource.WarrantyMarginDeduction]:
    'Удержание за простой по гарантии',
  [CustomerTransactionSource.MinimumWageCompensation]:
    'Доплата до гарантированного минимума',
};

export function getCustomerTransactionSourceLabel(source: number): string {
  return LABELS[source as CustomerTransactionSource] ?? `Источник ${source}`;
}

// Числовой enum даёт обратный маппинг (4 -> 'OrderSalary'), берём только прямые пары.
const enumValuesMap = Object.fromEntries(
  Object.entries(CustomerTransactionSource)
    .filter(([, value]) => typeof value === 'number')
    .map(([key, value]) => [
      key,
      { description: LABELS[value as CustomerTransactionSource] },
    ]),
);

registerEnumType(CustomerTransactionSource, {
  name: 'CustomerTransactionSource',
  description: 'Источник проводки по клиенту',
  valuesMap: enumValuesMap,
});
