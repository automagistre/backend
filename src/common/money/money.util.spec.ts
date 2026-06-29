import {
  normalizeAmount,
  toMoney,
  applyDefaultCurrency,
  isPositive,
  isNonNegative,
  assertSameCurrency,
  add,
  subtract,
  sum,
  multiplyByPercent,
  multiplyByQuantity,
  netFromPriceAndDiscount,
} from './money.util';
import type { Money } from './money.types';

const m = (amountMinor: bigint, currencyCode = 'RUB'): Money => ({
  amountMinor,
  currencyCode,
});

describe('money.util', () => {
  describe('normalizeAmount', () => {
    it('null/undefined → 0n, иначе значение как есть', () => {
      expect(normalizeAmount(null)).toBe(0n);
      expect(normalizeAmount(undefined)).toBe(0n);
      expect(normalizeAmount(0n)).toBe(0n);
      expect(normalizeAmount(150n)).toBe(150n);
    });
  });

  describe('toMoney / applyDefaultCurrency', () => {
    it('подставляет defaultCode при отсутствии валюты и нормализует сумму', () => {
      expect(toMoney(null, null, 'RUB')).toEqual(m(0n));
      expect(toMoney(500n, 'USD', 'RUB')).toEqual(m(500n, 'USD'));
      expect(applyDefaultCurrency({ amountMinor: 100n }, 'EUR')).toEqual(
        m(100n, 'EUR'),
      );
      expect(applyDefaultCurrency({}, 'RUB')).toEqual(m(0n));
    });
  });

  describe('isPositive / isNonNegative', () => {
    it('корректно классифицирует знак', () => {
      expect(isPositive(m(1n))).toBe(true);
      expect(isPositive(m(0n))).toBe(false);
      expect(isNonNegative(m(0n))).toBe(true);
      expect(isNonNegative(m(-1n))).toBe(false);
    });
  });

  describe('assertSameCurrency / add / subtract', () => {
    it('складывает и вычитает при совпадении валют', () => {
      expect(add(m(100n), m(50n))).toEqual(m(150n));
      expect(subtract(m(100n), m(30n))).toEqual(m(70n));
    });

    it('бросает при разных валютах', () => {
      expect(() => assertSameCurrency(m(1n, 'RUB'), m(1n, 'USD'))).toThrow(
        /Разные валюты/,
      );
      expect(() => add(m(1n, 'RUB'), m(1n, 'USD'))).toThrow();
    });
  });

  describe('sum', () => {
    it('пустой список → 0 в указанной валюте', () => {
      expect(sum([], 'USD')).toEqual(m(0n, 'USD'));
    });

    it('суммирует элементы одной валюты', () => {
      expect(sum([m(10n), m(20n), m(5n)])).toEqual(m(35n));
    });
  });

  describe('multiplyByPercent', () => {
    it('100 = 100%, 50 = 50%, округляет процент', () => {
      expect(multiplyByPercent(m(1000n), 100)).toEqual(m(1000n));
      expect(multiplyByPercent(m(1000n), 50)).toEqual(m(500n));
      expect(multiplyByPercent(m(1000n), 33.4)).toEqual(m(330n));
    });
  });

  describe('multiplyByQuantity', () => {
    it('количество в сотых: 100 = 1 ед.', () => {
      expect(multiplyByQuantity(1000n, 100)).toBe(1000n);
      expect(multiplyByQuantity(1000n, 250)).toBe(2500n);
      expect(multiplyByQuantity(1000n, 50)).toBe(500n);
    });
  });

  describe('netFromPriceAndDiscount', () => {
    it('price - discount, не меньше нуля, null → 0', () => {
      expect(netFromPriceAndDiscount(1000n, 300n)).toBe(700n);
      expect(netFromPriceAndDiscount(1000n, null)).toBe(1000n);
      expect(netFromPriceAndDiscount(300n, 1000n)).toBe(0n);
      expect(netFromPriceAndDiscount(null, null)).toBe(0n);
    });
  });
});
