import { registerEnumType } from '@nestjs/graphql';

/**
 * Ключи настроек должности. Каталог задаёт код, тенант их не создаёт.
 * Точка в имени значения GraphQL-энума недопустима, поэтому SCREAMING_SNAKE:
 * строка одна и та же в базе, в схеме и в клиенте после codegen.
 */
export enum StaffPositionSettingKey {
  WORK_EXECUTOR = 'WORK_EXECUTOR',
  CALENDAR_PARTICIPANT = 'CALENDAR_PARTICIPANT',
  CALENDAR_COLOR = 'CALENDAR_COLOR',
  CALENDAR_EXCLUDE_FROM_AUTO_ASSIGN = 'CALENDAR_EXCLUDE_FROM_AUTO_ASSIGN',
}

registerEnumType(StaffPositionSettingKey, {
  name: 'StaffPositionSettingKey',
  description: 'Ключ настройки должности из каталога',
});

/** Группа настроек: одна вкладка-аккордеон в интерфейсе. */
export enum StaffPositionSettingGroup {
  WORK = 'WORK',
  CALENDAR = 'CALENDAR',
}

registerEnumType(StaffPositionSettingGroup, {
  name: 'StaffPositionSettingGroup',
  description: 'Группа настроек должности',
});

/** Тип значения: по нему интерфейс выбирает контрол, а сервис — разбор значения. */
export enum StaffPositionSettingType {
  BOOLEAN = 'BOOLEAN',
  ENUM = 'ENUM',
  INT = 'INT',
  STRING = 'STRING',
}

registerEnumType(StaffPositionSettingType, {
  name: 'StaffPositionSettingType',
  description: 'Тип значения настройки должности',
});
