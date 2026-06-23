export const DAY_MS = 24 * 60 * 60 * 1000;

export interface ZonedParts {
  year: number;
  month: number; // 1-12
  day: number; // 1-31
  hours: number;
  minutes: number;
  seconds: number;
  weekday: number; // 1=Mon ... 7=Sun
}

export interface DateRange {
  from: Date;
  to: Date;
}

/** Диапазоны для сравнительного анализа месячных KPI. */
export interface ComparativeRanges {
  current: DateRange; // начало текущего месяца … now (MTD)
  momPrev: DateRange; // предыдущий месяц, обрезанный до того же дня/времени
  yoyPrev: DateRange; // тот же месяц прошлого года, обрезанный так же
}

/**
 * Компоненты даты в указанной зоне (год/месяц/день/часы/минуты/сек/день недели).
 */
export function toZonedParts(date: Date, tz: string): ZonedParts {
  const fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    weekday: 'short',
  });
  const parts = fmt.formatToParts(date);
  const get = (type: string) =>
    parts.find((p) => p.type === type)?.value ?? '0';
  const weekdayName = get('weekday');
  const weekdayMap: Record<string, number> = {
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
    Sun: 7,
  };
  return {
    year: Number(get('year')),
    month: Number(get('month')),
    day: Number(get('day')),
    hours: Number(get('hour') === '24' ? '0' : get('hour')),
    minutes: Number(get('minute')),
    seconds: Number(get('second')),
    weekday: weekdayMap[weekdayName] ?? 1,
  };
}

/**
 * Конвертирует "локальное" время в указанной зоне в абсолютную UTC-дату.
 * Строим naive UTC из компонентов, вычисляем смещение TZ для этого момента, корректируем.
 */
export function zonedToUtc(
  year: number,
  month1: number,
  day: number,
  hours: number,
  minutes: number,
  seconds: number,
  tz: string,
): Date {
  const naive = Date.UTC(year, month1 - 1, day, hours, minutes, seconds);
  const naiveDate = new Date(naive);
  const z = toZonedParts(naiveDate, tz);
  const localOfNaive = Date.UTC(
    z.year,
    z.month - 1,
    z.day,
    z.hours,
    z.minutes,
    z.seconds,
  );
  const offsetMs = localOfNaive - naive;
  return new Date(naive - offsetMs);
}

export function startOfDay(date: Date, tz: string): Date {
  const z = toZonedParts(date, tz);
  return zonedToUtc(z.year, z.month, z.day, 0, 0, 0, tz);
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}

export function addMs(date: Date, ms: number): Date {
  return new Date(date.getTime() + ms);
}

export function daysInMonth(year: number, month1: number): number {
  return new Date(Date.UTC(year, month1, 0)).getUTCDate();
}

/** Y-M-D ключ из локальной даты (полученной без TZ из date_trunc, читаем как UTC). */
export function dayKey(d: Date): string {
  const year = d.getUTCFullYear();
  const month = d.getUTCMonth() + 1;
  const day = d.getUTCDate();
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** Y-M-D ключ из локальной зоны для абсолютного UTC-инстанта. */
export function zonedDayKey(d: Date, tz: string): string {
  const z = toZonedParts(d, tz);
  return `${z.year}-${String(z.month).padStart(2, '0')}-${String(z.day).padStart(2, '0')}`;
}

/**
 * Для месяца (year, month) возвращает диапазоны current/previous (тот же месяц прошлого года).
 * - current: полный месяц этого года, для текущего месяца обрезается на now
 * - previous: тот же месяц прошлого года; для текущего обрезается на тот же день/время
 */
export function calcMonthYoyRanges(
  year: number,
  month: number,
  isCurrent: boolean,
  now: Date,
  tz: string,
): { current: DateRange; previous: DateRange } {
  const startCur = zonedToUtc(year, month, 1, 0, 0, 0, tz);
  const startPrevYear = zonedToUtc(year - 1, month, 1, 0, 0, 0, tz);

  const daysInCur = daysInMonth(year, month);
  const daysInPrev = daysInMonth(year - 1, month);

  const endCurFull = zonedToUtc(year, month, daysInCur, 23, 59, 59, tz);
  const endPrevFull = zonedToUtc(year - 1, month, daysInPrev, 23, 59, 59, tz);

  if (!isCurrent) {
    return {
      current: { from: startCur, to: addMs(endCurFull, 1000) },
      previous: { from: startPrevYear, to: addMs(endPrevFull, 1000) },
    };
  }

  // Текущий месяц: current до now, previous — тот же кусок прошлого года.
  const z = toZonedParts(now, tz);
  const currentEnd = now;
  const targetDay = Math.min(z.day, daysInPrev);
  const previousEnd = zonedToUtc(
    year - 1,
    month,
    targetDay,
    z.hours,
    z.minutes,
    z.seconds,
    tz,
  );
  return {
    current: { from: startCur, to: currentEnd },
    previous: { from: startPrevYear, to: previousEnd },
  };
}

/**
 * Диапазоны для сравнительного анализа: текущий месяц (MTD) против
 * предыдущего месяца (MoM) и того же месяца прошлого года (YoY).
 * Периоды сравнения обрезаются до того же дня/времени, что и now.
 */
export function calcComparativeRanges(now: Date, tz: string): ComparativeRanges {
  const z = toZonedParts(now, tz);

  const currentFrom = zonedToUtc(z.year, z.month, 1, 0, 0, 0, tz);

  // Предыдущий месяц.
  const prevMonthZeroBased = z.month - 2; // 0-based индекс пред. месяца
  const momYear = z.year + Math.floor(prevMonthZeroBased / 12);
  const momMonth = ((prevMonthZeroBased % 12) + 12) % 12 + 1;
  const momFrom = zonedToUtc(momYear, momMonth, 1, 0, 0, 0, tz);
  const momDay = Math.min(z.day, daysInMonth(momYear, momMonth));
  const momTo = zonedToUtc(
    momYear,
    momMonth,
    momDay,
    z.hours,
    z.minutes,
    z.seconds,
    tz,
  );

  // Тот же месяц прошлого года.
  const yoyFrom = zonedToUtc(z.year - 1, z.month, 1, 0, 0, 0, tz);
  const yoyDay = Math.min(z.day, daysInMonth(z.year - 1, z.month));
  const yoyTo = zonedToUtc(
    z.year - 1,
    z.month,
    yoyDay,
    z.hours,
    z.minutes,
    z.seconds,
    tz,
  );

  return {
    current: { from: currentFrom, to: now },
    momPrev: { from: momFrom, to: momTo },
    yoyPrev: { from: yoyFrom, to: yoyTo },
  };
}
