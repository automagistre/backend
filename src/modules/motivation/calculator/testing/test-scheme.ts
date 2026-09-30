import type {
  MotivationItemType,
  MotivationScheme,
} from '../motivation-calculator.types';
import { profileKey, TEAM_PROFILE } from '../motivation-stages';
import { buildStartScheme, type StartSchemePositions } from '../start-scheme';

/**
 * Профили как у стартовой схемы, но с фиксированными долями и весами 60/40:
 * суммы в тестах посчитаны вручную и не должны зависеть от калибровки.
 */
export function buildTestScheme(
  positions: StartSchemePositions,
): MotivationScheme {
  const scheme = buildStartScheme(positions);
  for (const type of Object.keys(scheme.rates) as MotivationItemType[]) {
    scheme.profiles[profileKey(type, TEAM_PROFILE)] = {
      [positions.masterId]: 60,
      [positions.adminId]: 40,
    };
  }
  scheme.rates = {
    SERVICE: { RECOMMENDATION: 300, TRANSFER: 700 },
    CONTRACTOR: { RECOMMENDATION: 150, TRANSFER: 350 },
    PART: { PICKING: 600, RECOMMENDATION: 120, TRANSFER: 280 },
    STORAGE: { CONTRACT: 500 },
  };
  return scheme;
}
