import { registerEnumType } from '@nestjs/graphql';

export enum ProfitLineKind {
  SERVICE = 'SERVICE',
  PART = 'PART',
  STORAGE = 'STORAGE',
}

registerEnumType(ProfitLineKind, {
  name: 'ProfitLineKind',
  description: 'Тип позиции в снапшоте прибыли',
  valuesMap: {
    SERVICE: { description: 'Работа' },
    PART: { description: 'Запчасть' },
    STORAGE: { description: 'Хранение шин' },
  },
});
