import { normalizeMoneyAmount } from './money.util';

describe('normalizeMoneyAmount', () => {
  it('null/undefined → 0n (не пишем NULL в money-поля)', () => {
    expect(normalizeMoneyAmount(null)).toBe(0n);
    expect(normalizeMoneyAmount(undefined)).toBe(0n);
  });

  it('0n остаётся валидным значением', () => {
    expect(normalizeMoneyAmount(0n)).toBe(0n);
  });

  it('положительные/отрицательные значения проходят как есть', () => {
    expect(normalizeMoneyAmount(1234n)).toBe(1234n);
    expect(normalizeMoneyAmount(-5n)).toBe(-5n);
  });
});
