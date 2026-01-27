export type RubCurrencyCode = 'RUB';

export function normalizeMoneyAmount(amount: bigint | null | undefined): bigint {
  // Для совместимости со старой CRM не пишем NULL в money-поля.
  // 0n — валидное значение, его нельзя трактовать как "пусто".
  return amount == null ? 0n : amount;
}

export function rubCurrencyCode(): RubCurrencyCode {
  return 'RUB';
}

