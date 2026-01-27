import { registerEnumType } from '@nestjs/graphql';

export enum CarEngineAirIntake {
  UNKNOWN,
  ATMOSPHERIC,
  TURBO,
}

export const CarEngineAirIntakeLabel = {
  [CarEngineAirIntake.UNKNOWN]: 'Неизвестно',
  [CarEngineAirIntake.ATMOSPHERIC]: 'Атмосферный',
  [CarEngineAirIntake.TURBO]: 'Турбо',
};

export const CarEngineAirIntakeShortLabel = {
  [CarEngineAirIntake.UNKNOWN]: '?',
  [CarEngineAirIntake.ATMOSPHERIC]: 'A',
  [CarEngineAirIntake.TURBO]: 'T',
};

registerEnumType(CarEngineAirIntake, {
  name: 'CarEngineAirIntake',
  description: 'Тип воздухозабора двигателя автомобиля',
  valuesMap: {
    UNKNOWN: {
      description: 'Неизвестно (?)',
    },
    ATMOSPHERIC: {
      description: 'Атмосферный (A)',
    },
    TURBO: {
      description: 'Турбо (T)',
    },
  },
});
