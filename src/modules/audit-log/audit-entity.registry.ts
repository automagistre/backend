import { AuditEntityType, AuditScope } from './enums/audit.enums';
import { OrderStatusLabel } from '../order/enums/order-status.enum';
import { CarTransmissionLabel } from '../vehicle/enums/car-transmission.enum';
import { CarWheelDriveLabel } from '../vehicle/enums/car-wheel-drive.enum';
import { CarEngineTypeLabel } from '../vehicle/enums/car-engine-type.enum';

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
  | 'vehicle'
  | 'orderItem';

/** Тип поля — определяет сравнение при diff и формат при чтении. */
export type AuditFieldKind =
  | { kind: 'scalar' }
  | { kind: 'bool' }
  | { kind: 'date' }
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
  [AuditEntityType.CAR]: {
    scope: AuditScope.GROUP,
    fields: {
      vehicleId: { label: 'Модель', kind: { kind: 'relation', ref: 'vehicle' } },
      identifier: { label: 'VIN', kind: { kind: 'scalar' } },
      gosnomer: { label: 'Госномер', kind: { kind: 'scalar' } },
      year: { label: 'Год', kind: { kind: 'scalar' } },
      mileage: { label: 'Пробег', kind: { kind: 'scalar' } },
      description: { label: 'Примечание', kind: { kind: 'scalar' } },
      equipmentEngineName: { label: 'Двигатель', kind: { kind: 'scalar' } },
      equipmentEngineCapacity: { label: 'Объём двигателя', kind: { kind: 'scalar' } },
      equipmentTransmission: {
        label: 'КПП',
        kind: { kind: 'status', labels: CarTransmissionLabel },
      },
      equipmentWheelDrive: {
        label: 'Привод',
        kind: { kind: 'status', labels: CarWheelDriveLabel },
      },
      equipmentEngineType: {
        label: 'Тип двигателя',
        kind: { kind: 'status', labels: CarEngineTypeLabel },
      },
    },
  },
  [AuditEntityType.CAR_RECOMMENDATION]: {
    scope: AuditScope.GROUP,
    fields: {
      service: { label: 'Работа', kind: { kind: 'scalar' } },
      workerId: { label: 'Исполнитель', kind: { kind: 'relation', ref: 'worker' } },
      priceAmount: { label: 'Цена', kind: money('priceCurrencyCode') },
      expiredAt: { label: 'Действует до', kind: { kind: 'date' } },
    },
  },
  [AuditEntityType.CAR_RECOMMENDATION_PART]: {
    scope: AuditScope.GROUP,
    fields: {
      partId: { label: 'Запчасть', kind: { kind: 'relation', ref: 'part' } },
      quantity: { label: 'Количество', kind: { kind: 'quantityX100' } },
      priceAmount: { label: 'Цена', kind: money('priceCurrencyCode') },
    },
  },
};

export function getAuditEntityDef(entityType: AuditEntityType): AuditEntityDef {
  return AUDIT_REGISTRY[entityType];
}
