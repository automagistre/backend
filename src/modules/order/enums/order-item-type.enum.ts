import { registerEnumType } from '@nestjs/graphql';

export enum OrderItemType {
  GROUP = 'group',
  SERVICE = 'service',
  PART = 'part',
}

registerEnumType(OrderItemType, {
  name: 'OrderItemType',
  description: 'Тип элемента заказа',
  valuesMap: {
    GROUP: {
      description: 'Группа',
    },
    SERVICE: {
      description: 'Работа',
    },
    PART: {
      description: 'Запчасть',
    },
  },
});
