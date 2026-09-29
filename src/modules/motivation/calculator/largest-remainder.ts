export type WeightedShare<K> = { key: K; weight: bigint };

/**
 * Делит сумму пропорционально весам без потери копеек: сначала целые части,
 * остаток — по копейке тем, у кого больше дробная часть. При равенстве решает
 * порядок во входном массиве, поэтому вызывающий передаёт его отсортированным.
 */
export function splitLargestRemainder<K>(
  total: bigint,
  shares: WeightedShare<K>[],
): Map<K, bigint> {
  if (total < 0n) {
    throw new Error('Делить можно только неотрицательную сумму');
  }
  const active = shares.filter((share) => share.weight > 0n);
  const weightSum = active.reduce((sum, share) => sum + share.weight, 0n);
  if (weightSum === 0n) {
    throw new Error('Сумма весов должна быть больше нуля');
  }

  const parts = active.map((share, index) => ({
    key: share.key,
    index,
    amount: (total * share.weight) / weightSum,
    remainder: (total * share.weight) % weightSum,
  }));

  let leftover = total - parts.reduce((sum, part) => sum + part.amount, 0n);
  const byRemainder = [...parts].sort((a, b) =>
    a.remainder === b.remainder
      ? a.index - b.index
      : a.remainder > b.remainder
        ? -1
        : 1,
  );
  for (const part of byRemainder) {
    if (leftover === 0n) break;
    part.amount += 1n;
    leftover -= 1n;
  }

  const result = new Map<K, bigint>();
  for (const part of parts) {
    result.set(part.key, (result.get(part.key) ?? 0n) + part.amount);
  }
  return result;
}
