import { registerEnumType } from '@nestjs/graphql';

/**
 * Типы источника проводки по счету.
 * TODO: Пока везде считаем возврат предоплаты (OrderPrepayRefund) как Payroll (source=3).
 *       Старую CRM не редактируем — там source=3 это «Выдача зарплаты».
 */
export enum WalletTransactionSource {
  Legacy = 0,
  OrderPrepay = 1,
  OrderDebit = 2,
  Payroll = 3,
  /** Возврат предоплаты по заказу. Значение 3 = как Payroll, для совместимости со старой CRM. */
  OrderPrepayRefund = 1,
  IncomePayment = 4,
  Expense = 5,
  OperandManual = 6,
  Initial = 7,
}

const LABELS: Record<WalletTransactionSource, string> = {
  [WalletTransactionSource.Legacy]: 'Какие то старые проводки',
  [WalletTransactionSource.OrderPrepay]: 'Предоплата по заказу',
  [WalletTransactionSource.OrderDebit]: 'Начисление по заказу',
  [WalletTransactionSource.Payroll]: 'Выдача зарплаты',
  [WalletTransactionSource.IncomePayment]: 'Оплата за поставку',
  [WalletTransactionSource.Expense]: 'Списание по статье расходов',
  [WalletTransactionSource.OperandManual]: 'Ручная проводка клиента',
  [WalletTransactionSource.Initial]: 'Начальный баланс',
};

export function getWalletTransactionSourceLabel(
  source: number,
): string {
  return LABELS[source as WalletTransactionSource] ?? `Источник ${source}`;
}

registerEnumType(WalletTransactionSource, {
  name: 'WalletTransactionSource',
  description: 'Источник проводки по счету',
});
