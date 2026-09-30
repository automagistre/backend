import type { MotivationScheme } from './motivation-calculator.types';
import { PARTS_PROFILE, profileKey, TEAM_PROFILE } from './motivation-stages';

/** Должности у каждого тенанта свои, поэтому схема собирается под их id. */
export type StartSchemePositions = {
  masterId: string;
  adminId: string;
  partsId: string;
};

/**
 * Доли — от прибыли позиции. Работа: 20% рекомендации, 5% переводу в работу.
 * Запчасть: 20% подбор, 8% рекомендация, 2% перевод.
 */
export function buildStartScheme(
  positions: StartSchemePositions,
): MotivationScheme {
  const team = () => ({
    [positions.masterId]: 70,
    [positions.adminId]: 30,
  });

  return {
    profiles: {
      [profileKey('SERVICE', TEAM_PROFILE)]: team(),
      [profileKey('CONTRACTOR', TEAM_PROFILE)]: team(),
      [profileKey('PART', TEAM_PROFILE)]: team(),
      [profileKey('PART', PARTS_PROFILE)]: { [positions.partsId]: 1 },
      [profileKey('STORAGE', TEAM_PROFILE)]: team(),
    },
    rates: {
      SERVICE: { RECOMMENDATION: 2000, TRANSFER: 500 },
      CONTRACTOR: { RECOMMENDATION: 1600, TRANSFER: 400 },
      PART: { PICKING: 2000, RECOMMENDATION: 800, TRANSFER: 200 },
      STORAGE: { CONTRACT: 2000 },
    },
  };
}
