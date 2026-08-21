import { registerEnumType } from '@nestjs/graphql';

/**
 * Отметка на конкретный день, перекрывающая цикл.
 * Отсутствие отметки — не значение, а «идём по циклу», поэтому нейтрального члена здесь нет.
 */
export enum ShiftDayKind {
  /** Вышел вне графика: подмена, дополнительный выход, сотрудник «по требованию». */
  WORK = 'WORK',
  VACATION = 'VACATION',
  SICK = 'SICK',
  /** Отгул или просто не вышел в свой рабочий день. */
  DAY_OFF = 'DAY_OFF',
}

registerEnumType(ShiftDayKind, {
  name: 'ShiftDayKind',
  description: 'Тип отметки в графике работы',
});

export const SHIFT_DAY_KIND_LABELS: Record<ShiftDayKind, string> = {
  [ShiftDayKind.WORK]: 'Выход вне графика',
  [ShiftDayKind.VACATION]: 'Отпуск',
  [ShiftDayKind.SICK]: 'Больничный',
  [ShiftDayKind.DAY_OFF]: 'Отгул',
};

export function isShiftDayKind(value: string): value is ShiftDayKind {
  return Object.values(ShiftDayKind).includes(value as ShiftDayKind);
}
