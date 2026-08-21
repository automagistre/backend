import type {
  StaffPosition,
  StaffPositionSetting,
} from 'src/generated/prisma/client';
import { StaffPositionSettingKey } from './enums/staff-position-setting.enum';
import { StaffPositionModel } from './models/staff-position.model';

export type StaffPositionWithSettings = StaffPosition & {
  settings: StaffPositionSetting[];
};

export const STAFF_POSITION_INCLUDE = { settings: true } as const;

/** Наружу настройки отдаём плоским списком пар: отдельная таблица — деталь хранения. */
export function toStaffPositionModel(
  position: StaffPositionWithSettings,
): StaffPositionModel {
  const { settings, ...rest } = position;
  return {
    ...rest,
    settings: settings.map((setting) => ({
      key: setting.key as StaffPositionSettingKey,
      value: setting.value,
    })),
  };
}
