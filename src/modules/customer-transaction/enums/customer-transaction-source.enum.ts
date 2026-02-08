import { registerEnumType } from '@nestjs/graphql';

/** Типы источника проводки по клиенту (операнду). */
export enum CustomerTransactionSource {
  OrderPrepay = 1,
  OrderDebit = 2,
  OrderPayment = 3,
  /** Зарплата по заказу (sourceId = orderItemId). OrderPrepayRefund — алиас для возврата предоплаты (source=4). */
  OrderSalary = 4,
  OrderPrepayRefund = OrderSalary,
  /** Начисление ежемесячного оклада (sourceId = employee_salary.id) */
  MonthlySalary = 8,
  Manual = 10,
  ManualWithoutWallet = 11,
}

const LABELS: Record<CustomerTransactionSource, string> = {
  [CustomerTransactionSource.OrderPrepay]: 'Предоплата по заказу',
  [CustomerTransactionSource.OrderDebit]: 'Начисление по заказу',
  [CustomerTransactionSource.OrderPayment]: 'Списание по заказу',
  [CustomerTransactionSource.OrderSalary]: 'Зарплата по заказу',
  [CustomerTransactionSource.MonthlySalary]: 'Начисление ежемесячного оклада',
  [CustomerTransactionSource.Manual]: 'Ручная проводка',
  [CustomerTransactionSource.ManualWithoutWallet]: 'Ручная проводка (без счёта)',
};

export function getCustomerTransactionSourceLabel(source: number): string {
  return LABELS[source as CustomerTransactionSource] ?? `Источник ${source}`;
}

registerEnumType(CustomerTransactionSource, {
  name: 'CustomerTransactionSource',
  description: 'Источник проводки по клиенту',
});
