import { registerEnumType } from '@nestjs/graphql';

export enum WwwTireFittingCategory {
  unknown = 'unknown',
  car = 'car',
  suv = 'suv',
  crossover = 'crossover',
  minivan = 'minivan',
}

export const TIRE_FITTING_CATEGORY_TO_INT: Record<WwwTireFittingCategory, number> = {
  [WwwTireFittingCategory.unknown]: 0,
  [WwwTireFittingCategory.car]: 1,
  [WwwTireFittingCategory.suv]: 2,
  [WwwTireFittingCategory.crossover]: 3,
  [WwwTireFittingCategory.minivan]: 4,
};

registerEnumType(WwwTireFittingCategory, {
  name: 'SiteTireFittingCategory',
  description: 'Категория шиномонтажа',
});
