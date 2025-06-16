import { registerEnumType } from "@nestjs/graphql";

export enum CarTransmission {
  UNKNOWN,
  AUTOMATIC,
  ROBOT,
  VARIATOR,
  MECHANICAL,
  AUTOMATIC_5,
  AUTOMATIC_7,
} 

export const CarTransmissionLabel = {
  [CarTransmission.UNKNOWN]: 'Неизвестно',
  [CarTransmission.AUTOMATIC]: 'Автоматическая',
  [CarTransmission.ROBOT]: 'Робот',
  [CarTransmission.VARIATOR]: 'Вариатор',
  [CarTransmission.MECHANICAL]: 'Механическая',
  [CarTransmission.AUTOMATIC_5]: 'Автоматическая 5',
  [CarTransmission.AUTOMATIC_7]: 'Автоматическая 7',
}

export const CarTransmissionShortLabel = {
  [CarTransmission.UNKNOWN]: '?',
  [CarTransmission.AUTOMATIC]: 'AT',
  [CarTransmission.ROBOT]: 'AMT',
  [CarTransmission.VARIATOR]: 'CVT',
  [CarTransmission.MECHANICAL]: 'MT',
  [CarTransmission.AUTOMATIC_5]: 'AT5',
  [CarTransmission.AUTOMATIC_7]: 'AT7',
}

registerEnumType(CarTransmission, {
  name: 'CarTransmission',
  description: 'Тип трансмиссии автомобиля',
  valuesMap: {
    UNKNOWN: {
      description: 'Неизвестно (?)',
    },
    AUTOMATIC: {
      description: 'Автоматическая (AT)',
    },
    ROBOT: {
      description: 'Робот (AMT)',
    },
    VARIATOR: {
      description: 'Вариатор (CVT)',
    },
    MECHANICAL: {
      description: 'Механическая (MT)',
    },
    AUTOMATIC_5: {
      description: 'Автоматическая 5 (AT5)',
    },
    AUTOMATIC_7: {
      description: 'Автоматическая 7 (AT7)',
    },
  },
});
