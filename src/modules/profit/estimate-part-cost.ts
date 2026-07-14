/** Наценка 40%: цена = себестоимость × 1,4 → cost = revenue × 100 / 140 */
export const LEGACY_PART_MARKUP_PERCENT = 40;

export function estimatePartCostFromMarkup(
  revenue: bigint,
  markupPercent = LEGACY_PART_MARKUP_PERCENT,
): bigint {
  if (revenue <= 0n || markupPercent <= 0) {
    return 0n;
  }
  const divisor = 100n + BigInt(markupPercent);
  return (revenue * 100n) / divisor;
}

/** Маржа запчастей % = profit / revenue × 100 */
export function calcPartsMarginPercent(
  profit: bigint,
  revenue: bigint,
): number | null {
  if (revenue <= 0n) {
    return null;
  }
  return Number((profit * 10000n) / revenue) / 100;
}
