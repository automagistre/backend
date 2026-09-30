import type {
  MotivationChainStep,
  MotivationScheme,
} from './motivation-calculator.types';

/** Должности у каждого тенанта свои, поэтому схема собирается под их id. */
export type StartSchemePositions = {
  masterId: string;
  adminId: string;
  partsId: string;
};

export const TEAM_PROFILE = 'team';
export const PARTS_PROFILE = 'parts';

/** Перевод в работу: снимок позиции, до появления снимков — график на момент создания. */
const TRANSFER_CHAIN: MotivationChainStep[] = [
  { source: 'SNAPSHOT:ITEM', profile: TEAM_PROFILE },
  { source: 'SCHEDULE:ITEM', profile: TEAM_PROFILE },
];

/**
 * Рекомендация без снимка — по графику на момент создания; до начала графика
 * доля уходит команде перевода в работу.
 */
const RECOMMENDATION_CHAIN: MotivationChainStep[] = [
  { source: 'SNAPSHOT:RECOMMENDATION', profile: TEAM_PROFILE },
  { source: 'SCHEDULE:RECOMMENDATION', profile: TEAM_PROFILE },
];

/**
 * Работа без рекомендации — вся доля команде перевода в работу. Запчасть:
 * 20% прибыли — подбор, 10% — команде по тем же долям, что у работ.
 */
export function buildStartScheme(
  positions: StartSchemePositions,
): MotivationScheme {
  const serviceStages = [
    {
      stage: 'RECOMMENDATION' as const,
      shareBp: 8000,
      chain: RECOMMENDATION_CHAIN,
      policy: 'REDISTRIBUTE' as const,
    },
    {
      stage: 'TRANSFER' as const,
      shareBp: 2000,
      chain: TRANSFER_CHAIN,
      policy: 'KEEP_IN_FUND' as const,
    },
  ];

  return {
    profiles: {
      [TEAM_PROFILE]: { [positions.masterId]: 70, [positions.adminId]: 30 },
      [PARTS_PROFILE]: { [positions.partsId]: 1 },
    },
    types: {
      SERVICE: { rateBp: 2500, stages: serviceStages },
      CONTRACTOR: { rateBp: 2000, stages: serviceStages },
      PART: {
        rateBp: 3000,
        stages: [
          {
            stage: 'PICKING',
            shareBp: 6667,
            chain: [
              { source: 'ACTOR:PICKER', profile: PARTS_PROFILE },
              { source: 'SNAPSHOT:ITEM', profile: PARTS_PROFILE },
              { source: 'SCHEDULE:ITEM', profile: PARTS_PROFILE },
              { source: 'SNAPSHOT:ITEM', profile: TEAM_PROFILE },
              { source: 'SCHEDULE:ITEM', profile: TEAM_PROFILE },
            ],
            policy: 'KEEP_IN_FUND',
          },
          {
            stage: 'RECOMMENDATION',
            shareBp: 2666,
            chain: RECOMMENDATION_CHAIN,
            policy: 'REDISTRIBUTE',
            // Рекомендация — часть продажи, в личный подбор её доля не переходит
            redistributeTo: ['TRANSFER'],
          },
          {
            stage: 'TRANSFER',
            shareBp: 667,
            chain: TRANSFER_CHAIN,
            policy: 'KEEP_IN_FUND',
          },
        ],
      },
      STORAGE: {
        rateBp: 2000,
        stages: [
          {
            stage: 'CONTRACT',
            shareBp: 10_000,
            chain: [
              { source: 'SNAPSHOT:CONTRACT', profile: TEAM_PROFILE },
              { source: 'SCHEDULE:CONTRACT', profile: TEAM_PROFILE },
            ],
            policy: 'KEEP_IN_FUND',
          },
        ],
      },
    },
  };
}
