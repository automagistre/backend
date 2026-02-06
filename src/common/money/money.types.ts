/**
 * Денежная сумма: минорные единицы (копейки) + код валюты.
 * Используется внутри модуля money и при работе с MoneyInput.
 */
export interface Money {
  amountMinor: bigint;
  currencyCode: string;
}
