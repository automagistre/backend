import { registerEnumType } from '@nestjs/graphql';

export enum BodyType {
  UNKNOWN = 0,
  SEDAN = 1,
  HATCHBACK = 2,
  LIFTBACK = 3,
  ALLROAD = 4,
  WAGON = 5,
  COUPE = 6,
  MINIVAN = 7,
  PICKUP = 8,
  LIMOUSINE = 9,
  VAN = 10,
  CABRIO = 11,
}

export const BodyTypeLabel = {
  [BodyType.UNKNOWN]: 'Неизвестно',
  [BodyType.SEDAN]: 'Седан',
  [BodyType.HATCHBACK]: 'Хэтчбек',
  [BodyType.LIFTBACK]: 'Лифтбек',
  [BodyType.ALLROAD]: 'Внедорожник',
  [BodyType.WAGON]: 'Универсал',
  [BodyType.COUPE]: 'Купе',
  [BodyType.MINIVAN]: 'Минивэн',
  [BodyType.PICKUP]: 'Пикап',
  [BodyType.LIMOUSINE]: 'Лимузин',
  [BodyType.VAN]: 'Фургон',
  [BodyType.CABRIO]: 'Кабриолет',
};

export const BodyTypeShortLabel = {
  [BodyType.UNKNOWN]: '?',
  [BodyType.SEDAN]: 'sedan',
  [BodyType.HATCHBACK]: 'hatchback',
  [BodyType.LIFTBACK]: 'liftback',
  [BodyType.ALLROAD]: 'allroad',
  [BodyType.WAGON]: 'wagon',
  [BodyType.COUPE]: 'coupe',
  [BodyType.MINIVAN]: 'minivan',
  [BodyType.PICKUP]: 'pickup',
  [BodyType.LIMOUSINE]: 'limousine',
  [BodyType.VAN]: 'van',
  [BodyType.CABRIO]: 'cabrio',
};

registerEnumType(BodyType, {
  name: 'BodyType',
  description: 'Тип кузова автомобиля',
  valuesMap: {
    UNKNOWN: {
      description: 'Неизвестно (?)',
    },
    SEDAN: {
      description: 'Седан (sedan)',
    },
    HATCHBACK: {
      description: 'Хэтчбек (hatchback)',
    },
    LIFTBACK: {
      description: 'Лифтбек (liftback)',
    },
    ALLROAD: {
      description: 'Внедорожник (allroad)',
    },
    WAGON: {
      description: 'Универсал (wagon)',
    },
    COUPE: {
      description: 'Купе (coupe)',
    },
    MINIVAN: {
      description: 'Минивэн (minivan)',
    },
    PICKUP: {
      description: 'Пикап (pickup)',
    },
    LIMOUSINE: {
      description: 'Лимузин (limousine)',
    },
    VAN: {
      description: 'Фургон (van)',
    },
    CABRIO: {
      description: 'Кабриолет (cabrio)',
    },
  },
});
