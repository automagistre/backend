import { registerEnumType } from '@nestjs/graphql';

/** Типы источника проводки по клиенту (операнду). */
export enum CustomerTransactionSource {
  OrderPrepay = 1,
  OrderDebit = 2,
  OrderPayment = 3,
  /** Зарплата по заказу (sourceId = orderItemId)*/
  OrderSalary = 4,
  OrderPrepayRefund = 4,
  Manual = 10,
  ManualWithoutWallet = 11,
}

const LABELS: Record<CustomerTransactionSource, string> = {
  [CustomerTransactionSource.OrderPrepay]: 'Предоплата по заказу',
  [CustomerTransactionSource.OrderDebit]: 'Начисление по заказу',
  [CustomerTransactionSource.OrderPayment]: 'Списание по заказу',
  [CustomerTransactionSource.OrderSalary]: 'Зарплата по заказу',
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
