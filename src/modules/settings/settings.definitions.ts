import type { Prisma } from 'src/generated/prisma/client';

export const SETTINGS_KEYS = {
  defaultCurrencyCode: 'defaultCurrencyCode',
  minMarkupRatio: 'minMarkupRatio',
  supplyExpiryDays: 'supplyExpiryDays',
  qualityControlDelayDays: 'qualityControlDelayDays',
  qualityControlStartHour: 'qualityControlStartHour',
  workDayStart: 'workDayStart',
  workDayEnd: 'workDayEnd',
  timezone: 'timezone',
} as const;

export type SettingKey = (typeof SETTINGS_KEYS)[keyof typeof SETTINGS_KEYS];

export const SETTING_KEYS_LIST = Object.values(SETTINGS_KEYS) as SettingKey[];

export type SettingsValueByKey = {
  [SETTINGS_KEYS.defaultCurrencyCode]: string;
  [SETTINGS_KEYS.minMarkupRatio]: number;
  [SETTINGS_KEYS.supplyExpiryDays]: number;
  [SETTINGS_KEYS.qualityControlDelayDays]: number;
  [SETTINGS_KEYS.qualityControlStartHour]: number;
  [SETTINGS_KEYS.workDayStart]: string;
  [SETTINGS_KEYS.workDayEnd]: string;
  [SETTINGS_KEYS.timezone]: string;
};

type SettingDefinition<K extends SettingKey> = {
  key: K;
  defaultValue: SettingsValueByKey[K];
  parse: (raw: Prisma.JsonValue) => SettingsValueByKey[K];
};

const parseString = (raw: Prisma.JsonValue): string => {
  if (typeof raw !== 'string') {
    throw new Error('Expected string setting value');
  }
  const normalized = raw.trim();
  if (!normalized) {
    throw new Error('String setting cannot be empty');
  }
  return normalized;
};

const parseNumber = (raw: Prisma.JsonValue): number => {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) {
    throw new Error('Expected number setting value');
  }
  return raw;
};

const parseIntNumber = (raw: Prisma.JsonValue): number => {
  const parsed = parseNumber(raw);
  if (!Number.isInteger(parsed)) {
    throw new Error('Expected integer setting value');
  }
  return parsed;
};

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

const parseTime = (raw: Prisma.JsonValue): string => {
  const value = parseString(raw);
  if (!TIME_RE.test(value)) {
    throw new Error('Expected time in HH:MM format');
  }
  return value;
};

/** 'HH:MM' → минуты от полуночи. */
export function timeToMinutes(value: string): number {
  const [h, m] = value.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

/** Длительность рабочего дня в часах (может быть дробной), вычисляется из start/end. */
export function computeWorkDayHours(start: string, end: string): number {
  const minutes = Math.max(0, timeToMinutes(end) - timeToMinutes(start));
  return minutes / 60;
}

export const SETTINGS_DEFINITIONS: {
  [K in SettingKey]: SettingDefinition<K>;
} = {
  [SETTINGS_KEYS.defaultCurrencyCode]: {
    key: SETTINGS_KEYS.defaultCurrencyCode,
    defaultValue: 'RUB',
    parse: (raw) => parseString(raw).toUpperCase(),
  },
  [SETTINGS_KEYS.minMarkupRatio]: {
    key: SETTINGS_KEYS.minMarkupRatio,
    defaultValue: 1.25,
    parse: parseNumber,
  },
  [SETTINGS_KEYS.supplyExpiryDays]: {
    key: SETTINGS_KEYS.supplyExpiryDays,
    defaultValue: 7,
    parse: parseIntNumber,
  },
  [SETTINGS_KEYS.qualityControlDelayDays]: {
    key: SETTINGS_KEYS.qualityControlDelayDays,
    defaultValue: 2,
    parse: parseIntNumber,
  },
  [SETTINGS_KEYS.qualityControlStartHour]: {
    key: SETTINGS_KEYS.qualityControlStartHour,
    defaultValue: 10,
    parse: (raw) => {
      const value = parseIntNumber(raw);
      if (value < 0 || value > 23) {
        throw new Error('Start hour must be between 0 and 23');
      }
      return value;
    },
  },
  [SETTINGS_KEYS.workDayStart]: {
    key: SETTINGS_KEYS.workDayStart,
    defaultValue: '10:00',
    parse: parseTime,
  },
  [SETTINGS_KEYS.workDayEnd]: {
    key: SETTINGS_KEYS.workDayEnd,
    defaultValue: '21:00',
    parse: parseTime,
  },
  [SETTINGS_KEYS.timezone]: {
    key: SETTINGS_KEYS.timezone,
    defaultValue: 'Europe/Moscow',
    parse: (raw) => parseString(raw),
  },
};

export function isSettingKey(value: string): value is SettingKey {
  return (SETTING_KEYS_LIST as string[]).includes(value);
}
