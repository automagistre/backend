import { registerEnumType } from '@nestjs/graphql';

export enum ProfitLineKind {
  SERVICE = 'SERVICE',
  PART = 'PART',
}

registerEnumType(ProfitLineKind, {
  name: 'ProfitLineKind',
  description: 'Тип позиции в снапшоте прибыли',
});
