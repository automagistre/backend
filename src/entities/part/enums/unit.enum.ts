import { registerEnumType } from '@nestjs/graphql';

export enum Unit {
  THING = 1,
  PACKAGE = 2,
  MILLILITER = 3,
  LITER = 4,
  GRAM = 5,
  KILOGRAM = 6,
  MILLIMETER = 7,
  METER = 8,
}

export const UnitShortLabel = {
  [Unit.THING]: 'шт',
  [Unit.PACKAGE]: 'упак',
  [Unit.MILLILITER]: 'мл',
  [Unit.LITER]: 'л',
  [Unit.GRAM]: 'гр',
  [Unit.KILOGRAM]: 'кг',
  [Unit.MILLIMETER]: 'мм',
  [Unit.METER]: 'м',
};

export const UnitLabel = {
  [Unit.THING]: 'Штука',
  [Unit.PACKAGE]: 'Упаковка',
  [Unit.MILLILITER]: 'Миллилитр',
  [Unit.LITER]: 'Литр',
  [Unit.GRAM]: 'Грамм',
  [Unit.KILOGRAM]: 'Килограмм',
  [Unit.MILLIMETER]: 'Миллиметр',
  [Unit.METER]: 'Метр',
};

registerEnumType(Unit, {
  name: 'Unit',
  description: 'Единицы измерения',
  valuesMap: {
    THING: {
      description: 'Штука (шт)',
    },
    PACKAGE: {
      description: 'Упаковка (упак)',
    },
    MILLILITER: {
      description: 'Миллилитр (мл)',
    },
    LITER: {
      description: 'Литр (л)',
    },
    GRAM: {
      description: 'Грамм (гр)',
    },
    KILOGRAM: {
      description: 'Килограмм (кг)',
    },
    MILLIMETER: {
      description: 'Миллиметр (мм)',
    },
    METER: {
      description: 'Метр (м)',
    },
  },
}); 