import { allocateOverhead, paymentOverhead } from './overhead';
import type { Money } from 'src/common/money';

const rub = (amountMinor: bigint): Money => ({
  amountMinor,
  currencyCode: 'RUB',
});

describe('накладные расходы платежа', () => {
  it('налог входит в сумму, эквайринг считается от полной', () => {
    expect(paymentOverhead(rub(10_500n), 5, 150)).toEqual(rub(500n + 157n));
  });

  it('нулевые ставки и нулевая сумма не дают расходов', () => {
    expect(paymentOverhead(rub(10_000n), 0, 0)).toEqual(rub(0n));
    expect(paymentOverhead(rub(0n), 5, 150)).toEqual(rub(0n));
  });

  it('возврат уменьшает расходы', () => {
    const paid = paymentOverhead(rub(10_000n), 5, 0);
    const refunded = paymentOverhead(rub(-4_000n), 5, 0);
    expect(refunded.amountMinor).toBeLessThan(0n);
    expect(paid.amountMinor + refunded.amountMinor).toBeLessThan(
      paid.amountMinor,
    );
  });
});

describe('allocateOverhead', () => {
  const row = (revenue: bigint, profit: bigint) => ({
    revenueAmount: revenue,
    profitAmount: profit,
  });

  it('делит пропорционально выручке, копейка остатка — большей доле', () => {
    const [first, second] = allocateOverhead(
      [row(100n, 80n), row(200n, 50n)],
      rub(10n),
    );
    expect(first.overheadAmount + second.overheadAmount).toBe(10n);
    expect(first.overheadAmount).toBe(3n);
    expect(second.overheadAmount).toBe(7n);
    expect(first.profitBeforeOverhead).toBe(80n);
    expect(first.profitAmount).toBe(77n);
    expect(second.profitAmount).toBe(43n);
  });

  it('нулевая выручка — расходы не относятся', () => {
    const [only] = allocateOverhead([row(0n, -100n)], rub(500n));
    expect(only.overheadAmount).toBe(0n);
    expect(only.profitAmount).toBe(-100n);
  });

  it('отрицательные расходы уменьшают нагрузку', () => {
    const [only] = allocateOverhead([row(100n, 40n)], rub(-10n));
    expect(only.overheadAmount).toBe(-10n);
    expect(only.profitAmount).toBe(50n);
  });
});
