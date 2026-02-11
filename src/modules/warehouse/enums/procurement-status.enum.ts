import { registerEnumType } from '@nestjs/graphql';

/** Статус необходимости закупки для строки таблицы Закупки. */
export enum ProcurementStatus {
  /** Отрицательное количество на складе */
  SUBZERO_QUANTITY = 'SUBZERO_QUANTITY',
  /** Нужна поставка для заказа (в заказах > 0, не покрыто поставкой) */
  NEED_SUPPLY_FOR_ORDER = 'NEED_SUPPLY_FOR_ORDER',
  /** Нужно восполнить запасы (orderUpToQuantity не достигнут, leftInStock <= orderFrom) */
  NEED_SUPPLY_FOR_STOCK = 'NEED_SUPPLY_FOR_STOCK',
  /** Заказано / всё ок */
  ORDERED = 'ORDERED',
}

registerEnumType(ProcurementStatus, {
  name: 'ProcurementStatus',
  description: 'Статус необходимости закупки',
  valuesMap: {
    SUBZERO_QUANTITY: {
      description: 'Отрицательное количество на складе',
    },
    NEED_SUPPLY_FOR_ORDER: {
      description: 'Нужна поставка для заказа',
    },
    NEED_SUPPLY_FOR_STOCK: {
      description: 'Нужно восполнить запасы',
    },
    ORDERED: {
      description: 'Заказано',
    },
  },
});
