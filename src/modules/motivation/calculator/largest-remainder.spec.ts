import { splitLargestRemainder } from './largest-remainder';

describe('splitLargestRemainder', () => {
  it('делит пропорционально весам', () => {
    const result = splitLargestRemainder(840n, [
      { key: 'master', weight: 60n },
      { key: 'admin', weight: 40n },
    ]);
    expect(result).toEqual(
      new Map([
        ['master', 504n],
        ['admin', 336n],
      ]),
    );
  });

  it('остаток уходит большей дробной части', () => {
    // 10 × 1/6 = 1.67, 10 × 5/6 = 8.33 → 2 и 8
    const result = splitLargestRemainder(10n, [
      { key: 'a', weight: 1n },
      { key: 'b', weight: 5n },
    ]);
    expect(result.get('a')).toBe(2n);
    expect(result.get('b')).toBe(8n);
  });

  it('при равных остатках решает порядок во входе', () => {
    const result = splitLargestRemainder(2n, [
      { key: 'x', weight: 1n },
      { key: 'y', weight: 1n },
      { key: 'z', weight: 1n },
    ]);
    expect([...result.values()]).toEqual([1n, 1n, 0n]);
  });

  it('нулевые веса пропускаются', () => {
    const result = splitLargestRemainder(5n, [
      { key: 'a', weight: 0n },
      { key: 'b', weight: 3n },
    ]);
    expect(result.has('a')).toBe(false);
    expect(result.get('b')).toBe(5n);
  });

  it('без положительных весов и с отрицательной суммой — ошибка', () => {
    expect(() =>
      splitLargestRemainder(5n, [{ key: 'a', weight: 0n }]),
    ).toThrow();
    expect(() =>
      splitLargestRemainder(-1n, [{ key: 'a', weight: 1n }]),
    ).toThrow();
  });
});
