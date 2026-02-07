import { registerEnumType } from '@nestjs/graphql';

export enum CloseDeficiency {
  MILEAGE_MISSING = 'MILEAGE_MISSING',
  SERVICES_WITHOUT_WORKER = 'SERVICES_WITHOUT_WORKER',
}

registerEnumType(CloseDeficiency, {
  name: 'CloseDeficiency',
  description: 'Недостаток для закрытия заказа',
  valuesMap: {
    MILEAGE_MISSING: {
      description: 'Не указан пробег',
    },
    SERVICES_WITHOUT_WORKER: {
      description: 'Работы без исполнителя',
    },
  },
});
