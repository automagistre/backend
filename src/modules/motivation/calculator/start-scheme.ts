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

/** Перевод в работу: снимок позиции, для старой истории — справочник команд. */
const TRANSFER_CHAIN: MotivationChainStep[] = [
  { source: 'SNAPSHOT:ITEM', profile: TEAM_PROFILE },
  { source: 'HISTORICAL_TEAM:ITEM_AUTHOR', profile: TEAM_PROFILE },
  { source: 'HISTORICAL_TEAM:ORDER_AUTHOR', profile: TEAM_PROFILE },
];

const RECOMMENDATION_CHAIN: MotivationChainStep[] = [
  { source: 'SNAPSHOT:RECOMMENDATION', profile: TEAM_PROFILE },
];

/** Ставки фонда — стартовые, калибруются на бэктесте. */
export function buildStartScheme(
  positions: StartSchemePositions,
): MotivationScheme {
  const serviceStages = [
    {
      stage: 'RECOMMENDATION' as const,
      shareBp: 3000,
      chain: RECOMMENDATION_CHAIN,
      policy: 'REDISTRIBUTE' as const,
    },
    {
      stage: 'TRANSFER' as const,
      shareBp: 7000,
      chain: TRANSFER_CHAIN,
      policy: 'KEEP_IN_FUND' as const,
    },
  ];

  return {
    profiles: {
      [TEAM_PROFILE]: { [positions.masterId]: 60, [positions.adminId]: 40 },
      [PARTS_PROFILE]: { [positions.partsId]: 1 },
    },
    types: {
      SERVICE: { rateBp: 1000, stages: serviceStages },
      CONTRACTOR: { rateBp: 500, stages: serviceStages },
      PART: {
        rateBp: 1000,
        stages: [
          {
            stage: 'PICKING',
            shareBp: 6000,
            chain: [
              { source: 'ACTOR:PICKER', profile: PARTS_PROFILE },
              { source: 'SNAPSHOT:ITEM', profile: PARTS_PROFILE },
              { source: 'SNAPSHOT:ITEM', profile: TEAM_PROFILE },
            ],
            policy: 'KEEP_IN_FUND',
          },
          {
            stage: 'RECOMMENDATION',
            shareBp: 1200,
            chain: RECOMMENDATION_CHAIN,
            policy: 'REDISTRIBUTE',
            // Рекомендация — часть продажи, в личный подбор её доля не переходит
            redistributeTo: ['TRANSFER'],
          },
          {
            stage: 'TRANSFER',
            shareBp: 2800,
            chain: TRANSFER_CHAIN,
            policy: 'KEEP_IN_FUND',
          },
        ],
      },
      STORAGE: {
        rateBp: 500,
        stages: [
          {
            stage: 'CONTRACT',
            shareBp: 10_000,
            chain: [{ source: 'SNAPSHOT:CONTRACT', profile: TEAM_PROFILE }],
            policy: 'KEEP_IN_FUND',
          },
        ],
      },
    },
  };
}
