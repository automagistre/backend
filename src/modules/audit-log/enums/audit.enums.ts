import { registerEnumType } from '@nestjs/graphql';

/** Scope события: определяет правило авторизации чтения и какое поле tenant заполнять. */
export enum AuditScope {
  TENANT = 'TENANT',
  GROUP = 'GROUP',
  // GLOBAL — зарезервировано до рефакторинга справочников.
}

/** Тип сущности/агрегата (root). В БД хранится строкой, источник истины — этот enum. */
export enum AuditEntityType {
  ORDER = 'ORDER',
  ORDER_ITEM_GROUP = 'ORDER_ITEM_GROUP',
  ORDER_ITEM_SERVICE = 'ORDER_ITEM_SERVICE',
  ORDER_ITEM_PART = 'ORDER_ITEM_PART',
  RESERVATION = 'RESERVATION',
  WALLET_TRANSACTION = 'WALLET_TRANSACTION',
  SALARY = 'SALARY',
  CAR = 'CAR',
  CAR_RECOMMENDATION = 'CAR_RECOMMENDATION',
  CAR_RECOMMENDATION_PART = 'CAR_RECOMMENDATION_PART',
  PERSON = 'PERSON',
  ORGANIZATION = 'ORGANIZATION',
  CALENDAR_ENTRY = 'CALENDAR_ENTRY',
}

/** Вид значения изменения — определяет форматирование на фронте. */
export enum AuditChangeKind {
  MONEY = 'MONEY',
  QUANTITY = 'QUANTITY',
  BOOL = 'BOOL',
  DATE = 'DATE',
  DATETIME = 'DATETIME',
  DURATION = 'DURATION',
  TEXT = 'TEXT',
}

/** Действие. CREATE/UPDATE/DELETE выводятся из diff, остальное — явные бизнес-действия. */
export enum AuditAction {
  CREATE = 'CREATE',
  UPDATE = 'UPDATE',
  DELETE = 'DELETE',
  STATUS_CHANGE = 'STATUS_CHANGE',
  CLOSE = 'CLOSE',
  CANCEL = 'CANCEL',
  SUSPEND = 'SUSPEND',
  WAKE = 'WAKE',
  PREPAY = 'PREPAY',
  REFUND = 'REFUND',
  DEBIT = 'DEBIT',
  RESERVE = 'RESERVE',
  RELEASE = 'RELEASE',
  SALARY_ACCRUE = 'SALARY_ACCRUE',
  REALIZE = 'REALIZE',
  RETURN_TO_RECOMMENDATION = 'RETURN_TO_RECOMMENDATION',
}

registerEnumType(AuditScope, {
  name: 'AuditScope',
  description: 'Область видимости события аудита',
});

registerEnumType(AuditEntityType, {
  name: 'AuditEntityType',
  description: 'Тип сущности в журнале аудита',
});

registerEnumType(AuditAction, {
  name: 'AuditAction',
  description: 'Действие в журнале аудита',
});

registerEnumType(AuditChangeKind, {
  name: 'AuditChangeKind',
  description: 'Вид значения изменения для форматирования',
});
