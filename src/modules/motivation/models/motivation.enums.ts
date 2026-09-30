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

export enum MotivationPolicyEnum {
  REDISTRIBUTE = 'REDISTRIBUTE',
  KEEP_IN_FUND = 'KEEP_IN_FUND',
}

export enum MotivationRowOutcomeEnum {
  ACCRUED = 'ACCRUED',
  KEPT_IN_FUND = 'KEPT_IN_FUND',
  UNATTRIBUTED = 'UNATTRIBUTED',
}

export enum MotivationKeepReasonEnum {
  NOT_APPLICABLE = 'NOT_APPLICABLE',
  NO_RECIPIENTS = 'NO_RECIPIENTS',
}

export enum MotivationExclusionReasonEnum {
  WARRANTY = 'WARRANTY',
  BEFORE_SCHEDULE = 'BEFORE_SCHEDULE',
}

registerEnumType(MotivationItemTypeEnum, {
  name: 'MotivationItemType',
  description: 'Тип позиции для премии',
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

registerEnumType(MotivationPolicyEnum, {
  name: 'MotivationPolicy',
  description: 'Что делать с долей этапа без адресата',
  valuesMap: {
    REDISTRIBUTE: { description: 'Отдать другим этапам позиции' },
    KEEP_IN_FUND: { description: 'Оставить в фонде' },
  },
});

registerEnumType(MotivationRowOutcomeEnum, {
  name: 'MotivationRowOutcome',
  description: 'Исход строки распределения',
});

registerEnumType(MotivationKeepReasonEnum, {
  name: 'MotivationKeepReason',
  description: 'Почему доля осталась в фонде',
  valuesMap: {
    NOT_APPLICABLE: { description: 'Этап не применим' },
    NO_RECIPIENTS: { description: 'Некому начислить' },
  },
});

registerEnumType(MotivationExclusionReasonEnum, {
  name: 'MotivationExclusionReason',
  description: 'Почему позиция не участвует в премии',
  valuesMap: {
    WARRANTY: { description: 'Гарантия' },
    BEFORE_SCHEDULE: { description: 'Создана до начала графика' },
  },
});
