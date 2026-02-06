import type { Money } from './money.types';

/**
 * Нормализация суммы: null/undefined → 0n.
 * Для совместимости со старой CRM не пишем NULL в money-поля.
 */
export function normalizeAmount(amount: bigint | null | undefined): bigint {
  return amount == null ? 0n : amount;
}

/**
 * Собрать Money из суммы и опционального кода валюты; при отсутствии валюты — defaultCode.
 */
export function toMoney(
  amountMinor: bigint | null | undefined,
  currencyCode: string | null | undefined,
  defaultCode: string,
): Money {
  return {
    amountMinor: normalizeAmount(amountMinor),
    currencyCode: currencyCode ?? defaultCode,
  };
}

/**
 * Применить валюту по умолчанию к частичному объекту (например из API).
 */
export function applyDefaultCurrency(
  partial: { amountMinor?: bigint | null; currencyCode?: string | null },
  defaultCode: string,
): Money {
  return toMoney(partial.amountMinor, partial.currencyCode, defaultCode);
}

export function isPositive(m: Money): boolean {
  return m.amountMinor > 0n;
}

export function isNonNegative(m: Money): boolean {
  return m.amountMinor >= 0n;
}

export function assertSameCurrency(a: Money, b: Money): void {
  if (a.currencyCode !== b.currencyCode) {
    throw new Error(
      `Разные валюты: ${a.currencyCode} и ${b.currencyCode}`,
    );
  }
}

export function add(a: Money, b: Money): Money {
  assertSameCurrency(a, b);
  return {
    amountMinor: a.amountMinor + b.amountMinor,
    currencyCode: a.currencyCode,
  };
}

export function subtract(a: Money, b: Money): Money {
  assertSameCurrency(a, b);
  return {
    amountMinor: a.amountMinor - b.amountMinor,
    currencyCode: a.currencyCode,
  };
}

/**
 * Умножить сумму на процент (в сотых долях: 100 = 100%).
 */
export function multiplyByPercent(
  m: Money,
  percentHundredths: number,
): Money {
  const result =
    (m.amountMinor * BigInt(Math.round(percentHundredths))) / 100n;
  return { amountMinor: result, currencyCode: m.currencyCode };
}

/**
 * Умножить сумму на количество в сотых долях (100 = 1 ед.).
 * Возвращает bigint (минорные единицы), без привязки к валюте для промежуточных расчётов.
 */
export function multiplyByQuantity(
  amountMinor: bigint,
  quantityHundredths: number,
): bigint {
  return (amountMinor * BigInt(quantityHundredths)) / 100n;
}

/**
 * Чистая цена после скидки: price - discount, не меньше 0.
 */
export function netFromPriceAndDiscount(
  priceMinor?: bigint | null,
  discountMinor?: bigint | null,
): bigint {
  const net =
    normalizeAmount(priceMinor) - normalizeAmount(discountMinor);
  return net < 0n ? 0n : net;
}
