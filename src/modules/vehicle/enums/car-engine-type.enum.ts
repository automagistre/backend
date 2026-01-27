import { registerEnumType } from '@nestjs/graphql';

export enum CarEngineType {
  UNKNOWN = 0,
  PETROL = 1,
  DIESEL = 2,
  ETHANOL = 3,
  ELECTRIC = 4,
  HYBRID = 5,
}

export const CarEngineTypeLabel = {
  [CarEngineType.UNKNOWN]: 'Неизвестно',
  [CarEngineType.PETROL]: 'Бензин',
  [CarEngineType.DIESEL]: 'Дизель',
  [CarEngineType.ETHANOL]: 'Этанол',
  [CarEngineType.ELECTRIC]: 'Электрический',
  [CarEngineType.HYBRID]: 'Гибридный',
};

export const CarEngineTypeShortLabel = {
  [CarEngineType.UNKNOWN]: '?',
  [CarEngineType.PETROL]: 'P',
  [CarEngineType.DIESEL]: 'D',
  [CarEngineType.ETHANOL]: 'ET',
  [CarEngineType.ELECTRIC]: 'E',
  [CarEngineType.HYBRID]: 'H',
};

registerEnumType(CarEngineType, {
  name: 'CarEngineType',
  description: 'Тип двигателя автомобиля',
  valuesMap: {
    UNKNOWN: {
      description: 'Неизвестно (?)',
    },
    PETROL: {
      description: 'Бензин (P)',
    },
    DIESEL: {
      description: 'Дизель (D)',
    },
    ETHANOL: {
      description: 'Этанол (ET)',
    },
    ELECTRIC: {
      description: 'Электрический (E)',
    },
    HYBRID: {
      description: 'Гибридный (H)',
    },
  },
});
