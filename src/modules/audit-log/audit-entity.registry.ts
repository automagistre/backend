import { AuditEntityType, AuditScope } from './enums/audit.enums';
import { OrderStatusLabel } from '../order/enums/order-status.enum';

/** Денежное значение в журнале: minor-строкой (BigInt не сериализуется в JSON). */
export type AuditMoney = { amountMinor: string; currencyCode: string };

export type AuditValue = string | number | boolean | null | AuditMoney;

/** Сырое изменение поля, как хранится в `changes` JSON. */
export interface AuditRawChange {
  field: string;
  oldValue: AuditValue;
  newValue: AuditValue;
  /** Подпись значения-связи на момент события (исполнитель/запчасть и т.п.). */
  oldDisplay?: string | null;
  newDisplay?: string | null;
}

/** Цель связи — как резолвить читаемое имя по id. */
export type AuditRelationRef =
  | 'part'
  | 'organization'
  | 'worker'
  | 'operand'
  | 'car'
  | 'orderItem';

/** Тип поля — определяет сравнение при diff и формат при чтении. */
export type AuditFieldKind =
  | { kind: 'scalar' }
  | { kind: 'bool' }
  | { kind: 'money'; currencyField?: string }
  | { kind: 'quantity' }
  | { kind: 'quantityX100' }
  | { kind: 'status'; labels: Record<number, string> }
  | { kind: 'relation'; ref: AuditRelationRef };

export interface AuditFieldDef {
  label: string;
  kind: AuditFieldKind;
}

export interface AuditEntityDef {
  scope: AuditScope;
  fields: Record<string, AuditFieldDef>;
}

const money = (currencyField?: string): AuditFieldDef['kind'] => ({
  kind: 'money',
  currencyField,
});

/**
 * Реестр логируемых сущностей. Подключение новой сущности = добавить запись сюда.
 * На текущем этапе — домен «Заказ» и связанные движения (scope TENANT).
 */
export const AUDIT_REGISTRY: Record<AuditEntityType, AuditEntityDef> = {
  [AuditEntityType.ORDER]: {
    scope: AuditScope.TENANT,
    fields: {
      status: { label: 'Статус', kind: { kind: 'status', labels: OrderStatusLabel } },
      carId: { label: 'Автомобиль', kind: { kind: 'relation', ref: 'car' } },
      customerId: { label: 'Заказчик', kind: { kind: 'relation', ref: 'operand' } },
      workerId: { label: 'Исполнитель', kind: { kind: 'relation', ref: 'worker' } },
      mileage: { label: 'Пробег', kind: { kind: 'scalar' } },
      description: { label: 'Описание', kind: { kind: 'scalar' } },
    },
  },
  [AuditEntityType.ORDER_ITEM_GROUP]: {
    scope: AuditScope.TENANT,
    fields: {
      name: { label: 'Название', kind: { kind: 'scalar' } },
      hideParts: { label: 'Скрывать запчасти', kind: { kind: 'bool' } },
    },
  },
  [AuditEntityType.ORDER_ITEM_SERVICE]: {
    scope: AuditScope.TENANT,
    fields: {
      service: { label: 'Работа', kind: { kind: 'scalar' } },
      workerId: { label: 'Исполнитель', kind: { kind: 'relation', ref: 'worker' } },
      warranty: { label: 'Гарантия', kind: { kind: 'bool' } },
      priceAmount: { label: 'Цена', kind: money('priceCurrencyCode') },
      discountAmount: { label: 'Скидка', kind: money('discountCurrencyCode') },
    },
  },
  [AuditEntityType.ORDER_ITEM_PART]: {
    scope: AuditScope.TENANT,
    fields: {
      partId: { label: 'Запчасть', kind: { kind: 'relation', ref: 'part' } },
      supplierId: { label: 'Поставщик', kind: { kind: 'relation', ref: 'organization' } },
      quantity: { label: 'Количество', kind: { kind: 'quantityX100' } },
      warranty: { label: 'Гарантия', kind: { kind: 'bool' } },
      priceAmount: { label: 'Цена', kind: money('priceCurrencyCode') },
      discountAmount: { label: 'Скидка', kind: money('discountCurrencyCode') },
    },
  },
  [AuditEntityType.RESERVATION]: {
    scope: AuditScope.TENANT,
    fields: {
      quantity: { label: 'Количество', kind: { kind: 'quantityX100' } },
    },
  },
  [AuditEntityType.WALLET_TRANSACTION]: {
    scope: AuditScope.TENANT,
    fields: {
      amount: { label: 'Сумма', kind: money() },
    },
  },
  [AuditEntityType.SALARY]: {
    scope: AuditScope.TENANT,
    fields: {
      amount: { label: 'Начислено', kind: money() },
    },
  },
};

export function getAuditEntityDef(entityType: AuditEntityType): AuditEntityDef {
  return AUDIT_REGISTRY[entityType];
}
