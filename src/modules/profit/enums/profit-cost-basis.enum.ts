import { registerEnumType } from '@nestjs/graphql';

export enum ProfitCostBasis {
  LAST_INCOME = 'LAST_INCOME',
  SALARY = 'SALARY',
  CONTRACTOR = 'CONTRACTOR',
  /** Оценка по наценке, когда нет закупки в бэкофилле */
  ESTIMATED_MARKUP = 'ESTIMATED_MARKUP',
  NONE = 'NONE',
}

registerEnumType(ProfitCostBasis, {
  name: 'ProfitCostBasis',
  description: 'Источник себестоимости в снапшоте прибыли',
});
