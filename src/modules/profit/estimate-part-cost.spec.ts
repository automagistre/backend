import {
  calcPartsMarginPercent,
  DEFAULT_PART_PROFIT_PERCENT,
  estimatePartCostFromMarkup,
  estimatePartCostFromProfitMargin,
  LEGACY_PART_MARKUP_PERCENT,
} from './estimate-part-cost';

describe('estimatePartCostFromMarkup', () => {
  it('наценка 40%: cost = revenue / 1.4', () => {
    expect(estimatePartCostFromMarkup(14000n)).toBe(10000n);
  });

  it('нулевая выручка → cost 0', () => {
    expect(estimatePartCostFromMarkup(0n)).toBe(0n);
  });

  it('использует переданный процент', () => {
    expect(estimatePartCostFromMarkup(20000n, 100)).toBe(10000n);
  });

  it('константа LEGACY_PART_MARKUP_PERCENT = 40', () => {
    expect(LEGACY_PART_MARKUP_PERCENT).toBe(40);
  });
});

describe('estimatePartCostFromProfitMargin', () => {
  it('маржа 30%: cost = 70% revenue', () => {
    expect(estimatePartCostFromProfitMargin(10000n)).toBe(7000n);
  });

  it('нулевая выручка → cost 0', () => {
    expect(estimatePartCostFromProfitMargin(0n)).toBe(0n);
  });

  it('константа DEFAULT_PART_PROFIT_PERCENT = 30', () => {
    expect(DEFAULT_PART_PROFIT_PERCENT).toBe(30);
  });
});

describe('calcPartsMarginPercent', () => {
  it('маржа 40%: profit 4000 при revenue 10000', () => {
    expect(calcPartsMarginPercent(4000n, 10000n)).toBe(40);
  });

  it('оценка backfill ~28,6%: profit 4000 при revenue 14000', () => {
    expect(calcPartsMarginPercent(4000n, 14000n)).toBeCloseTo(28.6, 1);
  });

  it('revenue=0 → null', () => {
    expect(calcPartsMarginPercent(5000n, 0n)).toBeNull();
  });
});
