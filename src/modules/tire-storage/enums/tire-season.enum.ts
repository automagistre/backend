import { registerEnumType } from '@nestjs/graphql';

export enum TireSeason {
  SUMMER = 'SUMMER',
  WINTER = 'WINTER',
  ALL_SEASON = 'ALL_SEASON',
}

registerEnumType(TireSeason, {
  name: 'TireSeason',
  description: 'Сезон шин',
  valuesMap: {
    SUMMER: { description: 'Летние' },
    WINTER: { description: 'Зимние' },
    ALL_SEASON: { description: 'Всесезонные' },
  },
});
