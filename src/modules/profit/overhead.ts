import {
  add,
  includedRate,
  multiplyByBasisPoints,
  subtract,
  toMoney,
  type Money,
} from 'src/common/money';

/** Налог внутри суммы плюс эквайринг от полной суммы. */
export function paymentOverhead(
  amount: Money,
  taxRatePercent: number,
  acquiringRateBp: number,
): Money {
  return add(
    includedRate(amount, taxRatePercent),
    multiplyByBasisPoints(amount, acquiringRateBp),
  );
}

type MoneyLike = bigint | number | null | undefined;

type OverheadRow = {
  revenueAmount: MoneyLike;
  profitAmount: MoneyLike;
  overheadAmount?: MoneyLike;
  profitBeforeOverhead?: MoneyLike;
};

function asMoney(value: MoneyLike): Money {
  return toMoney(value == null ? 0n : BigInt(value), '', '');
}

type Allocated<T> = Omit<
  T,
  'overheadAmount' | 'profitBeforeOverhead' | 'profitAmount'
> & {
  overheadAmount: bigint;
  profitBeforeOverhead: bigint;
  profitAmount: bigint;
};

/**
 * Делит расходы пропорционально выручке. Нулевая выручка — расходы не относятся.
 * Отрицательная сумма (возврат больше поступлений) уменьшает расходы.
 * Остаток копейки режется в минорных единицах: у Money нет дробного деления долей.
 */
export function allocateOverhead<T extends OverheadRow>(
  rows: T[],
  overhead: Money,
): Allocated<T>[] {
  const untouched = () =>
    rows.map((row) => {
      const profit = asMoney(row.profitAmount);
      return {
        ...row,
        overheadAmount: 0n,
        profitBeforeOverhead: profit.amountMinor,
        profitAmount: profit.amountMinor,
      };
    });
  if (overhead.amountMinor === 0n || rows.length === 0) return untouched();

  const weights = rows.map((row) => {
    const revenue = asMoney(row.revenueAmount).amountMinor;
    return revenue > 0n ? revenue : 0n;
  });
  const weightSum = weights.reduce((sum, weight) => sum + weight, 0n);
  if (weightSum === 0n) return untouched();

  const sign = overhead.amountMinor < 0n ? -1n : 1n;
  const shares = splitLargestRemainder(overhead.amountMinor * sign, weights);
  return rows.map((row, index) => {
    const share = asMoney(shares[index] * sign);
    const profit = asMoney(row.profitAmount);
    return {
      ...row,
      profitBeforeOverhead: profit.amountMinor,
      overheadAmount: share.amountMinor,
      profitAmount: subtract(profit, share).amountMinor,
    };
  });
}

/** Остаток копейки — строкам с большей дробной частью, при равенстве более ранним. */
function splitLargestRemainder(total: bigint, weights: bigint[]): bigint[] {
  const weightSum = weights.reduce((sum, weight) => sum + weight, 0n);
  const parts = weights.map((weight, index) => ({
    index,
    amount: weight > 0n ? (total * weight) / weightSum : 0n,
    remainder: weight > 0n ? (total * weight) % weightSum : 0n,
  }));
  let leftover = total - parts.reduce((sum, part) => sum + part.amount, 0n);
  const order = [...parts].sort((a, b) =>
    a.remainder === b.remainder
      ? a.index - b.index
      : a.remainder > b.remainder
        ? -1
        : 1,
  );
  for (const part of order) {
    if (leftover === 0n) break;
    if (weights[part.index] === 0n) continue;
    part.amount += 1n;
    leftover -= 1n;
  }
  return parts.map((part) => part.amount);
}
