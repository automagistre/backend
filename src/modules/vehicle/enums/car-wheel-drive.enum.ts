import { registerEnumType } from "@nestjs/graphql";

export enum CarWheelDrive {
  UNKNOWN,
  FRONT_WHEEL_DRIVE,
  REAR_WHEEL_DRIVE,
  ALL_WHEEL_DRIVE,
} 

export const CarWheelDriveLabel = {
  [CarWheelDrive.UNKNOWN]: 'Неизвестно',
  [CarWheelDrive.FRONT_WHEEL_DRIVE]: 'Передний',
  [CarWheelDrive.REAR_WHEEL_DRIVE]: 'Задний',
  [CarWheelDrive.ALL_WHEEL_DRIVE]: 'Полный',
}

export const CarWheelDriveShortLabel = {
  [CarWheelDrive.UNKNOWN]: '?',
  [CarWheelDrive.FRONT_WHEEL_DRIVE]: 'FWD',
  [CarWheelDrive.REAR_WHEEL_DRIVE]: 'RWD',
  [CarWheelDrive.ALL_WHEEL_DRIVE]: '4WD',
}

registerEnumType(CarWheelDrive, {
  name: 'CarWheelDrive',
  description: 'Тип привода автомобиля',
  valuesMap: {
    UNKNOWN: {
      description: 'Неизвестно (?)',
    },
    FRONT_WHEEL_DRIVE: {
      description: 'Передний (FWD)',
    },
    REAR_WHEEL_DRIVE: {
      description: 'Задний (RWD)',
    },
    ALL_WHEEL_DRIVE: {
      description: 'Полный (4WD)',
    },
  },
});
