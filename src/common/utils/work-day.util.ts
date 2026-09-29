import { dayKey, toZonedParts, zonedToUtc } from './zoned-time.util';

const MS_IN_MINUTE = 60_000;
const MINUTES_IN_DAY = 1440;

/** Часы работы тенанта: пояс и границы рабочего дня HH:MM из настроек. */
export type WorkDayHours = {
  timezone: string;
  workDayStart: string;
  workDayEnd: string;
};

export type WorkDayRange = { start: Date; end: Date };

/** 'HH:MM' → минуты от полуночи. */
export function timeToMinutes(value: string): number {
  const [h, m] = value.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

/**
 * Во сколько по местному времени начинается рабочий день, в минутах от полуночи его даты.
 * Не в полночь, а в середине ночного перерыва: при 10:00–21:00 — в 03:30. Отрицательное
 * значение — сутки начинаются накануне вечером (ранняя смена 06:00–15:00 → 22:30).
 */
function workDayOffsetMinutes(hours: WorkDayHours): number {
  const start = timeToMinutes(hours.workDayStart);
  const night =
    (start - timeToMinutes(hours.workDayEnd) + MINUTES_IN_DAY) % MINUTES_IN_DAY;
  return start - night / 2;
}

/**
 * Рабочий день момента времени (ГГГГ-ММ-ДД) в поясе тенанта. К этой границе
 * рабочий день гарантированно закончен: продажа в 00:30 после поздней смены
 * остаётся за этой сменой, ночная смена целиком относится к дате начала.
 */
export function resolveWorkDate(at: Date, hours: WorkDayHours): string {
  const local = toZonedParts(at, hours.timezone);
  const wallClock = Date.UTC(
    local.year,
    local.month - 1,
    local.day,
    local.hours,
    local.minutes,
    local.seconds,
  );
  return dayKey(
    new Date(wallClock - workDayOffsetMinutes(hours) * MS_IN_MINUTE),
  );
}

/** Границы рабочего дня `workDate` (ГГГГ-ММ-ДД): [start, end). */
export function workDayRange(
  workDate: string,
  hours: WorkDayHours,
): WorkDayRange {
  const [year, month, day] = workDate.split('-').map(Number);
  const offsetMs = workDayOffsetMinutes(hours) * MS_IN_MINUTE;
  const boundary = (dayShift: number) => {
    const wallClock = new Date(
      Date.UTC(year, month - 1, day + dayShift) + offsetMs,
    );
    return zonedToUtc(
      wallClock.getUTCFullYear(),
      wallClock.getUTCMonth() + 1,
      wallClock.getUTCDate(),
      wallClock.getUTCHours(),
      wallClock.getUTCMinutes(),
      wallClock.getUTCSeconds(),
      hours.timezone,
    );
  };
  return { start: boundary(0), end: boundary(1) };
}

/** Границы текущего рабочего дня. */
export function currentWorkDayRange(
  hours: WorkDayHours,
  now: Date = new Date(),
): WorkDayRange {
  return workDayRange(resolveWorkDate(now, hours), hours);
}
