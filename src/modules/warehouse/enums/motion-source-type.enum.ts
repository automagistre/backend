import { registerEnumType } from '@nestjs/graphql';

export enum MotionSourceType {
  MANUAL = 1,
  INCOME = 2,
  ORDER = 3,
  INVENTORIZATION = 4,
}

registerEnumType(MotionSourceType, {
  name: 'MotionSourceType',
  description: 'Типы источников движения запчастей',
  valuesMap: {
    MANUAL: { description: 'Ручное движение' },
    INCOME: { description: 'Приход' },
    ORDER: { description: 'Заказ' },
    INVENTORIZATION: { description: 'Инвентаризация' },
  },
});
