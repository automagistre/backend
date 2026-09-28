import { StaffPositionSettingKey } from 'src/modules/staff-position/enums/staff-position-setting.enum';
import type { StaffPositionWithSettings } from 'src/modules/staff-position/staff-position.mapper';
import { ShiftDayKind } from './enums/shift-day-kind.enum';

/** Цикл длиннее месяца перестаёт быть циклом, да и в матрицу месяца уже не читается. */
export const SHIFT_MASK_MAX_LENGTH = 31;

const MASK_RE = /^[01]+$/;
const MS_IN_DAY = 86_400_000;
const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

export type ShiftPattern = {
  shiftMask: string | null;
  shiftStartsOn: Date | null;
};

export type ResolvedShiftDay = {
  working: boolean;
  kind: ShiftDayKind | null;
};

/**
 * День графика — календарная дата, а не момент времени. Везде считаем по UTC-частям,
 * как это уже делает выборка календаря: иначе сервер в другом поясе съедет на сутки.
 */
export function toDayNumber(date: Date): number {
  return Math.floor(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) /
      MS_IN_DAY,
  );
}

export function toDateKey(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Ключ вида YYYY-MM-DD в дату: полдень UTC не съезжает на соседние сутки при любом поясе. */
export function parseDateKey(value: string): Date {
  if (!DATE_KEY_RE.test(value)) {
    throw new Error(`Ожидается дата в формате ГГГГ-ММ-ДД, получено «${value}»`);
  }
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (Number.isNaN(date.getTime()) || toDateKey(date) !== value) {
    throw new Error(`Такой даты не существует: «${value}»`);
  }
  return date;
}

/** Список ключей дней от начала до конца включительно. */
export function eachDateKey(from: Date, to: Date): string[] {
  const keys: string[] = [];
  const last = toDayNumber(to);
  for (let day = toDayNumber(from); day <= last; day += 1) {
    keys.push(toDateKey(new Date(day * MS_IN_DAY)));
  }
  return keys;
}

/** Сообщение уходит в интерфейс как есть, поэтому объясняет, что именно не так. */
export function assertShiftPattern(
  mask: string | null | undefined,
  startsOn: Date | null | undefined,
): void {
  if (!mask && !startsOn) return;
  if (!mask) {
    throw new Error('Дата начала цикла без самого цикла ничего не значит');
  }
  if (!startsOn) {
    throw new Error('Для цикла нужна дата, с которой он отсчитывается');
  }
  if (!MASK_RE.test(mask)) {
    throw new Error('Цикл описывается только символами 1 и 0');
  }
  if (mask.length > SHIFT_MASK_MAX_LENGTH) {
    throw new Error(`Цикл не длиннее ${SHIFT_MASK_MAX_LENGTH} дней`);
  }
  if (!mask.includes('1')) {
    throw new Error('В цикле должен быть хотя бы один рабочий день');
  }
}

/**
 * Смещение считаем и в минус: график, заведённый сегодня, читается и за прошлый месяц,
 * иначе матрица за прошедшие дни оказалась бы пустой.
 */
export function isWorkingByPattern(
  mask: string | null,
  startsOn: Date | null,
  date: Date,
): boolean {
  if (!mask || !startsOn || !MASK_RE.test(mask)) return false;
  const offset = toDayNumber(date) - toDayNumber(startsOn);
  const index = ((offset % mask.length) + mask.length) % mask.length;
  return mask[index] === '1';
}

/** Отпуск и больничный — про человека, а не про роль: гасят все его должности сразу. */
export function isPersonLevelKind(kind: ShiftDayKind): boolean {
  return kind === ShiftDayKind.VACATION || kind === ShiftDayKind.SICK;
}

/** Основная должность — меньший sortOrder, при равенстве меньший id: так же выбирает миграция. */
export function pickPrimaryLink<
  T extends { position: { id: string; sortOrder: number } },
>(links: T[]): T | undefined {
  return [...links].sort(
    (left, right) =>
      left.position.sortOrder - right.position.sortOrder ||
      (left.position.id < right.position.id ? -1 : 1),
  )[0];
}

/** Отметка на день сильнее цикла: подмена, отпуск и больничный на то и заводятся. */
export function resolveShiftDay(
  pattern: ShiftPattern,
  date: Date,
  override?: ShiftDayKind | null,
): ResolvedShiftDay {
  if (override) {
    return { working: override === ShiftDayKind.WORK, kind: override };
  }
  return {
    working: isWorkingByPattern(pattern.shiftMask, pattern.shiftStartsOn, date),
    kind: null,
  };
}

const COLUMN_SETTINGS = [
  StaffPositionSettingKey.CALENDAR_PARTICIPANT,
  StaffPositionSettingKey.WORK_EXECUTOR,
] as const;

function positionsHaveSetting(
  positions: StaffPositionWithSettings[],
  key: StaffPositionSettingKey,
): boolean {
  return positions.some((position) =>
    position.settings.some(
      (setting) =>
        (setting.key as StaffPositionSettingKey) === key &&
        setting.value === true,
    ),
  );
}

/**
 * «В смене» и «занимает колонку» — разные вопросы: смена есть и у запчастиста.
 * Гейт из двух настроек, потому что каждая закрывает свою дыру. Без WORK_EXECUTOR
 * в сетке появится столбец, куда работу назначить нельзя, а автораспределение начнёт
 * складывать туда записи. Без CALENDAR_PARTICIPANT колонку получит мастер-приёмщик,
 * который работы исполняет, но подъёмник не занимает.
 */
export function occupiesCalendarColumn(
  positions: StaffPositionWithSettings[],
): boolean {
  return COLUMN_SETTINGS.every((key) => positionsHaveSetting(positions, key));
}
