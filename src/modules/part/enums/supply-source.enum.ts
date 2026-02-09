import { registerEnumType } from '@nestjs/graphql';

/** Источник поступления запчасти в part_supply (source: 1 = MANUAL, 2 = INCOME). */
export enum SupplySource {
  MANUAL = 1,
  INCOME = 2,
}

registerEnumType(SupplySource, {
  name: 'SupplySource',
  description: 'Источник поступления запчасти',
  valuesMap: {
    MANUAL: { description: 'Ручное внесение' },
    INCOME: { description: 'Приход' },
  },
});
