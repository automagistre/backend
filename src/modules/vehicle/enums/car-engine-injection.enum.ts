import { registerEnumType } from "@nestjs/graphql";

export enum CarEngineInjection {
  UNKNOWN,
  CLASSIC,
  DIRECT,
} 

export const CarEngineInjectionLabel = {
  [CarEngineInjection.UNKNOWN]: 'Неизвестно',
  [CarEngineInjection.CLASSIC]: 'Классический',
  [CarEngineInjection.DIRECT]: 'Прямой',
};

export const CarEngineInjectionShortLabel = {
  [CarEngineInjection.UNKNOWN]: '?',
  [CarEngineInjection.CLASSIC]: 'I',
  [CarEngineInjection.DIRECT]: 'D',
}

registerEnumType(CarEngineInjection, {
  name: 'CarEngineInjection',
  description: 'Тип впрыска двигателя автомобиля',
  valuesMap: {
    UNKNOWN: {
      description: 'Неизвестно (?)',
    },
    CLASSIC: {
      description: 'Классический (I)',
    },
    DIRECT: {
      description: 'Прямой (D)',
    },
  },
});
