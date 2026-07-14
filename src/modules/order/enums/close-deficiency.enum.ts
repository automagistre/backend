import { registerEnumType } from '@nestjs/graphql';

export enum CloseDeficiency {
  MILEAGE_MISSING = 'MILEAGE_MISSING',
  SERVICES_WITHOUT_WORKER = 'SERVICES_WITHOUT_WORKER',
  CONTRACTOR_WITHOUT_COST = 'CONTRACTOR_WITHOUT_COST',
  WARRANTY_WITHOUT_PAYER = 'WARRANTY_WITHOUT_PAYER',
  WARRANTY_PAYER_NOT_ELIGIBLE = 'WARRANTY_PAYER_NOT_ELIGIBLE',
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
    CONTRACTOR_WITHOUT_COST: {
      description: 'Подрядные работы без себестоимости',
    },
    WARRANTY_WITHOUT_PAYER: {
      description: 'Гарантийная позиция без плательщика',
    },
    WARRANTY_PAYER_NOT_ELIGIBLE: {
      description:
        'Плательщик гарантии — сотрудник, но он не найден, уволен или не имеет ставки',
    },
  },
});
