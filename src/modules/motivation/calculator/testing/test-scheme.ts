import type {
  MotivationItemType,
  MotivationScheme,
  MotivationStage,
} from '../motivation-calculator.types';
import {
  buildStartScheme,
  TEAM_PROFILE,
  type StartSchemePositions,
} from '../start-scheme';

const SERVICE_SHARES: Partial<Record<MotivationStage, number>> = {
  RECOMMENDATION: 3000,
  TRANSFER: 7000,
};

const SHARES: Record<
  MotivationItemType,
  Partial<Record<MotivationStage, number>>
> = {
  SERVICE: SERVICE_SHARES,
  CONTRACTOR: SERVICE_SHARES,
  PART: { PICKING: 6000, RECOMMENDATION: 1200, TRANSFER: 2800 },
  STORAGE: {},
};

const RATES: Record<MotivationItemType, number> = {
  SERVICE: 1000,
  CONTRACTOR: 500,
  PART: 1000,
  STORAGE: 500,
};

/**
 * Цепочки как у стартовой схемы, но с фиксированными ставками, долями и весами:
 * суммы в тестах посчитаны вручную и не должны зависеть от калибровки.
 */
export function buildTestScheme(
  positions: StartSchemePositions,
): MotivationScheme {
  const scheme = buildStartScheme(positions);
  scheme.profiles[TEAM_PROFILE] = {
    [positions.masterId]: 60,
    [positions.adminId]: 40,
  };
  for (const type of Object.keys(RATES) as MotivationItemType[]) {
    scheme.types[type] = {
      rateBp: RATES[type],
      stages: scheme.types[type].stages.map((stage) => ({
        ...stage,
        shareBp: SHARES[type][stage.stage] ?? stage.shareBp,
      })),
    };
  }
  return scheme;
}
