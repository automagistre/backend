import { registerEnumType } from '@nestjs/graphql';

export enum MotivationItemTypeEnum {
  SERVICE = 'SERVICE',
  CONTRACTOR = 'CONTRACTOR',
  PART = 'PART',
  STORAGE = 'STORAGE',
}

export enum MotivationStageEnum {
  RECOMMENDATION = 'RECOMMENDATION',
  TRANSFER = 'TRANSFER',
  PICKING = 'PICKING',
  CONTRACT = 'CONTRACT',
}

export enum MotivationRowOutcomeEnum {
  ACCRUED = 'ACCRUED',
  KEPT_IN_FUND = 'KEPT_IN_FUND',
}

export enum MotivationKeepReasonEnum {
  NOT_APPLICABLE = 'NOT_APPLICABLE',
  NO_RECIPIENTS = 'NO_RECIPIENTS',
  FIRED = 'FIRED',
  SALARY_ONLY = 'SALARY_ONLY',
}

export enum MotivationExclusionReasonEnum {
  WARRANTY = 'WARRANTY',
  BEFORE_SCHEDULE = 'BEFORE_SCHEDULE',
}

export enum OrderMotivationModeEnum {
  PREVIEW = 'PREVIEW',
  ACCRUED = 'ACCRUED',
  NOT_ACCRUED = 'NOT_ACCRUED',
}

registerEnumType(MotivationItemTypeEnum, {
  name: 'MotivationItemType',
  description: 'Тип позиции для бонуса с продаж',
  valuesMap: {
    SERVICE: { description: 'Работа' },
    CONTRACTOR: { description: 'Подряд' },
    PART: { description: 'Запчасть' },
    STORAGE: { description: 'Хранение шин' },
  },
});

registerEnumType(MotivationStageEnum, {
  name: 'MotivationStage',
  description: 'Этап, за который платится часть фонда позиции',
  valuesMap: {
    RECOMMENDATION: { description: 'Рекомендация' },
    TRANSFER: { description: 'Перевод в работу' },
    PICKING: { description: 'Подбор запчасти' },
    CONTRACT: { description: 'Оформление договора' },
  },
});

registerEnumType(MotivationRowOutcomeEnum, {
  name: 'MotivationRowOutcome',
  description: 'Исход строки распределения',
  valuesMap: {
    ACCRUED: { description: 'Начислено сотруднику' },
    KEPT_IN_FUND: { description: 'Осталось организации, причина — в reason' },
  },
});

registerEnumType(MotivationKeepReasonEnum, {
  name: 'MotivationKeepReason',
  description: 'Почему доля осталась в фонде',
  valuesMap: {
    NOT_APPLICABLE: { description: 'Этап не применим' },
    NO_RECIPIENTS: { description: 'Некому начислить' },
    FIRED: { description: 'Сотрудник уволен — доля остаётся организации' },
    SALARY_ONLY: {
      description: 'Сотрудник только на окладе — доля остаётся организации',
    },
  },
});

registerEnumType(MotivationExclusionReasonEnum, {
  name: 'MotivationExclusionReason',
  description: 'Почему позиция не участвует в бонусе с продаж',
  valuesMap: {
    WARRANTY: { description: 'Гарантия' },
    BEFORE_SCHEDULE: { description: 'Создана до начала графика' },
  },
});

registerEnumType(OrderMotivationModeEnum, {
  name: 'OrderMotivationMode',
  description:
    'Бонус с продаж по заказу: прогноз, начислен или закрыт без начисления',
  valuesMap: {
    PREVIEW: { description: 'Заказ открыт, расчёт по действующей схеме' },
    ACCRUED: { description: 'Начислено при закрытии' },
    NOT_ACCRUED: { description: 'Заказ закрыт, начисления нет' },
  },
});
