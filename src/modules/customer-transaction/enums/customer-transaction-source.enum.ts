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
}

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
};

export function getCustomerTransactionSourceLabel(source: number): string {
  return LABELS[source as CustomerTransactionSource] ?? `Источник ${source}`;
}

registerEnumType(CustomerTransactionSource, {
  name: 'CustomerTransactionSource',
  description: 'Источник проводки по клиенту',
});
