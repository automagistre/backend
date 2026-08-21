/**
 * Цвет должности храним токеном палитры, а не готовым CSS: hex не переживёт смену темы.
 * Ярлыки живут здесь же — на клиент они уезжают опциями настройки из каталога.
 */
export const STAFF_POSITION_COLORS = [
  { token: 'blue', label: 'Синий' },
  { token: 'orange', label: 'Оранжевый' },
  { token: 'red', label: 'Красный' },
  { token: 'green', label: 'Зелёный' },
  { token: 'purple', label: 'Фиолетовый' },
  { token: 'teal', label: 'Бирюзовый' },
  { token: 'pink', label: 'Розовый' },
  { token: 'yellow', label: 'Жёлтый' },
] as const;

export type StaffPositionColorToken =
  (typeof STAFF_POSITION_COLORS)[number]['token'];

export const STAFF_POSITION_COLOR_TOKENS = STAFF_POSITION_COLORS.map(
  (color) => color.token,
) as readonly StaffPositionColorToken[];

export function isStaffPositionColorToken(
  value: string,
): value is StaffPositionColorToken {
  return (STAFF_POSITION_COLOR_TOKENS as readonly string[]).includes(value);
}
