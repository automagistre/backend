export const ORDER_CANCEL_REASON_LABELS = {
  client_refused_price: 'Клиент отказался из-за цены',
  client_refused_timeline: 'Клиент отказался из-за сроков',
  client_refused_no_need: 'Клиент передумал / неактуально',
  duplicate_order: 'Дублирующий заказ',
  client_no_response: 'Не выходит на связь',
  other: 'Другое',
} as const;

export type OrderCancelReasonCode = keyof typeof ORDER_CANCEL_REASON_LABELS;

export const ORDER_CANCEL_REASON_CODES = Object.keys(
  ORDER_CANCEL_REASON_LABELS,
) as OrderCancelReasonCode[];

export function getOrderCancelReasonLabel(reasonCode: string): string {
  return (
    ORDER_CANCEL_REASON_LABELS[
      reasonCode as keyof typeof ORDER_CANCEL_REASON_LABELS
    ] ?? reasonCode
  );
}
