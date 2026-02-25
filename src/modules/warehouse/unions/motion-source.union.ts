import { createUnionType } from '@nestjs/graphql';
import { OrderSourceModel } from '../models/order-source.model';
import { IncomeSourceModel } from '../models/income-source.model';
import { ManualSourceModel } from '../models/manual-source.model';
import { InventorizationSourceModel } from '../models/inventorization-source.model';

export type MotionSourceType =
  | (OrderSourceModel & { __type: 'ORDER' })
  | (IncomeSourceModel & { __type: 'INCOME' })
  | (ManualSourceModel & { __type: 'MANUAL' })
  | (InventorizationSourceModel & { __type: 'INVENTORIZATION' });

export const MotionSourceUnion = createUnionType({
  name: 'MotionSource',
  description: 'Источник движения запчасти',
  types: () =>
    [
      OrderSourceModel,
      IncomeSourceModel,
      ManualSourceModel,
      InventorizationSourceModel,
    ] as const,
  resolveType(value: { __type?: string }) {
    switch (value.__type) {
      case 'ORDER':
        return OrderSourceModel;
      case 'INCOME':
        return IncomeSourceModel;
      case 'MANUAL':
        return ManualSourceModel;
      case 'INVENTORIZATION':
        return InventorizationSourceModel;
      default:
        return ManualSourceModel;
    }
  },
});
