import { registerEnumType } from '@nestjs/graphql';

export enum ProfitOrigin {
  LIVE = 'LIVE',
  LEGACY_BACKFILL = 'LEGACY_BACKFILL',
}

registerEnumType(ProfitOrigin, {
  name: 'ProfitOrigin',
  description: 'Происхождение снапшота прибыли',
});
