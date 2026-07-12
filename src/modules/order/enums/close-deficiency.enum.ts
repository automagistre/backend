import { registerEnumType } from '@nestjs/graphql';

export enum CloseDeficiency {
  MILEAGE_MISSING = 'MILEAGE_MISSING',
  SERVICES_WITHOUT_WORKER = 'SERVICES_WITHOUT_WORKER',
  CONTRACTOR_WITHOUT_COST = 'CONTRACTOR_WITHOUT_COST',
  WARRANTY_WITHOUT_PAYER = 'WARRANTY_WITHOUT_PAYER',
  WARRANTY_EXECUTOR_REQUIRED = 'WARRANTY_EXECUTOR_REQUIRED',
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
    WARRANTY_EXECUTOR_REQUIRED: {
      description:
        'Гарантия за счёт исполнителя, но исполнителя-сотрудника (со ставкой) или ответственного по заказу нет',
    },
  },
});
