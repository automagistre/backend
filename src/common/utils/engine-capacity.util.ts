/**
 * Нормализация объёма двигателя для хранения и сравнения (точка, одна десятичная: 2.0, 1.6).
 */
export function normalizeEngineCapacity(
  capacity: string | null | undefined,
): string | null {
  if (capacity == null || capacity === '') return null;
  const s = capacity.replace(',', '.').trim();
  if (s === '') return null;
  const num = parseFloat(s);
  if (Number.isNaN(num)) return capacity;
  return num.toFixed(1);
}
