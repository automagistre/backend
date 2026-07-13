import { registerEnumType } from '@nestjs/graphql';

export enum ProfitCostBasis {
  LAST_INCOME = 'LAST_INCOME',
  SALARY = 'SALARY',
  CONTRACTOR = 'CONTRACTOR',
  NONE = 'NONE',
}

registerEnumType(ProfitCostBasis, {
  name: 'ProfitCostBasis',
  description: 'Источник себестоимости в снапшоте прибыли',
});
