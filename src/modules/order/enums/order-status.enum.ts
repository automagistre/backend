import { registerEnumType } from '@nestjs/graphql';

export enum OrderStatus {
  DRAFT = 1,
  SCHEDULING = 2,
  ORDERING = 3,
  MATCHING = 4,
  TRACKING = 5,
  DELIVERY = 6,
  NOTIFICATION = 7,
  WORKING = 8,
  READY = 9,
  CLOSED = 10,
  SELECTION = 11,
  PAYMENT_WAITING = 12,
  CANCELLED = 13,
}

export const OrderStatusLabel = {
  [OrderStatus.DRAFT]: 'Черновик',
  [OrderStatus.SCHEDULING]: 'Ожидание по записи',
  [OrderStatus.ORDERING]: 'Заказ запчастей',
  [OrderStatus.MATCHING]: 'Согласование',
  [OrderStatus.TRACKING]: 'Ожидание запчастей',
  [OrderStatus.DELIVERY]: 'Требуется доставка',
  [OrderStatus.NOTIFICATION]: 'Уведомление клиента',
  [OrderStatus.WORKING]: 'В работе',
  [OrderStatus.READY]: 'Ожидает выдачи',
  [OrderStatus.CLOSED]: 'Закрыт',
  [OrderStatus.SELECTION]: 'Подбор запчастей',
  [OrderStatus.PAYMENT_WAITING]: 'Ожидает Оплаты',
  [OrderStatus.CANCELLED]: 'Отменён',
};

export const OrderStatusSeverity = {
  [OrderStatus.DRAFT]: 'secondary',
  [OrderStatus.SCHEDULING]: 'info',
  [OrderStatus.ORDERING]: 'danger',
  [OrderStatus.MATCHING]: 'warning',
  [OrderStatus.TRACKING]: 'secondary',
  [OrderStatus.DELIVERY]: 'info',
  [OrderStatus.NOTIFICATION]: 'warning',
  [OrderStatus.WORKING]: 'success',
  [OrderStatus.READY]: 'info',
  [OrderStatus.CLOSED]: 'secondary',
  [OrderStatus.SELECTION]: 'danger',
  [OrderStatus.PAYMENT_WAITING]: 'info',
  [OrderStatus.CANCELLED]: 'secondary',
};

registerEnumType(OrderStatus, {
  name: 'OrderStatus',
  description: 'Статус заказа',
  valuesMap: {
    DRAFT: {
      description: 'Черновик',
    },
    SCHEDULING: {
      description: 'Ожидание по записи',
    },
    ORDERING: {
      description: 'Заказ запчастей',
    },
    MATCHING: {
      description: 'Согласование',
    },
    TRACKING: {
      description: 'Ожидание запчастей',
    },
    DELIVERY: {
      description: 'Требуется доставка',
    },
    NOTIFICATION: {
      description: 'Уведомление клиента',
    },
    WORKING: {
      description: 'В работе',
    },
    READY: {
      description: 'Ожидает выдачи',
    },
    CLOSED: {
      description: 'Закрыт',
    },
    SELECTION: {
      description: 'Подбор запчастей',
    },
    PAYMENT_WAITING: {
      description: 'Ожидает Оплаты',
    },
    CANCELLED: {
      description: 'Отменён',
    },
  },
});

