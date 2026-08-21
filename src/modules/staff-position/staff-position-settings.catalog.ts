import type { Prisma } from 'src/generated/prisma/client';
import {
  StaffPositionSettingGroup,
  StaffPositionSettingKey,
  StaffPositionSettingType,
} from './enums/staff-position-setting.enum';
import {
  isStaffPositionColorToken,
  STAFF_POSITION_COLORS,
} from './staff-position.colors';

export type StaffPositionSettingOption = {
  value: string;
  label: string;
  /** Токен палитры: интерфейс покажет образец цвета рядом с вариантом. */
  color?: string;
};

export type StaffPositionSettingDefinition = {
  key: StaffPositionSettingKey;
  group: StaffPositionSettingGroup;
  type: StaffPositionSettingType;
  label: string;
  /** Текст под иконкой info: что настройка меняет в поведении системы. */
  hint: string;
  /** Мастер группы: пока он выключен, остальные настройки группы не действуют. */
  isMaster: boolean;
  /** Только для типа ENUM. */
  options?: StaffPositionSettingOption[];
  parse: (raw: Prisma.JsonValue) => Prisma.InputJsonValue;
};

export type StaffPositionSettingGroupDefinition = {
  key: StaffPositionSettingGroup;
  label: string;
  hint: string;
};

const parseBoolean = (raw: Prisma.JsonValue): boolean => {
  if (typeof raw !== 'boolean') {
    throw new Error('Ожидается true или false');
  }
  return raw;
};

const parseColorToken = (raw: Prisma.JsonValue): string => {
  if (typeof raw !== 'string' || !isStaffPositionColorToken(raw)) {
    throw new Error('ожидается токен цвета из палитры');
  }
  return raw;
};

/** Порядок групп в интерфейсе задаётся порядком в этом списке. */
export const STAFF_POSITION_SETTING_GROUPS: StaffPositionSettingGroupDefinition[] =
  [
    {
      key: StaffPositionSettingGroup.WORK,
      label: 'Работы',
      hint: 'Участие сотрудника в исполнении работ по заказу',
    },
    {
      key: StaffPositionSettingGroup.CALENDAR,
      label: 'График работ',
      hint: 'Как должность ведёт себя в календаре записи',
    },
  ];

/**
 * Каталог настроек. Добавление настройки — одна запись здесь: интерфейс
 * отрисует контрол по типу, а сервис разберёт значение через parse.
 * Порядок внутри группы задаётся порядком в этом списке.
 */
export const STAFF_POSITION_SETTING_DEFINITIONS: StaffPositionSettingDefinition[] =
  [
    {
      key: StaffPositionSettingKey.WORK_EXECUTOR,
      group: StaffPositionSettingGroup.WORK,
      type: StaffPositionSettingType.BOOLEAN,
      label: 'Может быть исполнителем работ',
      hint: 'Сотрудник появляется в подборе исполнителя работ и в выборе работника заказа. Без этого в списках висят все сотрудники подряд, включая административный состав',
      isMaster: true,
      parse: parseBoolean,
    },
    {
      key: StaffPositionSettingKey.CALENDAR_PARTICIPANT,
      group: StaffPositionSettingGroup.CALENDAR,
      type: StaffPositionSettingType.BOOLEAN,
      label: 'Работает по графику',
      hint: 'Сотрудника можно назначить на запись в графике. Остальные настройки группы имеют смысл только при включённом переключателе',
      isMaster: true,
      parse: parseBoolean,
    },
    {
      key: StaffPositionSettingKey.CALENDAR_COLOR,
      group: StaffPositionSettingGroup.CALENDAR,
      type: StaffPositionSettingType.ENUM,
      label: 'Цвет колонки',
      hint: 'Каким цветом подсвечивается колонка сотрудника в графике. Не задан — цвет по умолчанию',
      isMaster: false,
      options: STAFF_POSITION_COLORS.map((color) => ({
        value: color.token,
        label: color.label,
        color: color.token,
      })),
      parse: parseColorToken,
    },
    {
      key: StaffPositionSettingKey.CALENDAR_EXCLUDE_FROM_AUTO_ASSIGN,
      group: StaffPositionSettingGroup.CALENDAR,
      type: StaffPositionSettingType.BOOLEAN,
      label: 'Не участвует в автораспределении',
      hint: 'Записи без исполнителя не раскидываются на сотрудника автоматически. Нужно специализированным механикам вроде сход-развала',
      isMaster: false,
      parse: parseBoolean,
    },
  ];

const DEFINITION_BY_KEY = new Map(
  STAFF_POSITION_SETTING_DEFINITIONS.map((definition) => [
    definition.key,
    definition,
  ]),
);

export function isStaffPositionSettingKey(
  value: string,
): value is StaffPositionSettingKey {
  return DEFINITION_BY_KEY.has(value as StaffPositionSettingKey);
}

export function getStaffPositionSettingDefinition(
  key: StaffPositionSettingKey,
): StaffPositionSettingDefinition | undefined {
  return DEFINITION_BY_KEY.get(key);
}

export function getStaffPositionSettingsOfGroup(
  group: StaffPositionSettingGroup,
): StaffPositionSettingDefinition[] {
  return STAFF_POSITION_SETTING_DEFINITIONS.filter(
    (definition) => definition.group === group,
  );
}
