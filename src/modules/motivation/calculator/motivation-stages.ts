import type {
  MotivationItemType,
  MotivationSourceRef,
  MotivationStage,
} from './motivation-calculator.types';

export const TEAM_PROFILE = 'team';
export const PARTS_PROFILE = 'parts';

/** Профиль весов у каждого типа свой: деление по должностям настраивается по типам независимо. */
export function profileKey(type: MotivationItemType, role: string): string {
  return `${type}:${role}`;
}

export type MotivationChainStep = {
  source: MotivationSourceRef;
  profile: string;
};

export type MotivationStageRule = {
  stage: MotivationStage;
  /** Адресат — первый шаг, где нашлись люди с весом в профиле. */
  chain: MotivationChainStep[];
  /** Адресата нет — доля этому этапу; у него тоже нет — остаётся организации. */
  fallbackTo?: MotivationStage;
};

/** Перевод в работу: снимок позиции, до появления снимков — график на момент создания. */
function transferChain(type: MotivationItemType): MotivationChainStep[] {
  return [
    { source: 'SNAPSHOT:ITEM', profile: profileKey(type, TEAM_PROFILE) },
    { source: 'SCHEDULE:ITEM', profile: profileKey(type, TEAM_PROFILE) },
  ];
}

/** Рекомендации не было или некому начислить — её доля команде перевода в работу. */
function recommendationRule(type: MotivationItemType): MotivationStageRule {
  return {
    stage: 'RECOMMENDATION',
    chain: [
      {
        source: 'SNAPSHOT:RECOMMENDATION',
        profile: profileKey(type, TEAM_PROFILE),
      },
      {
        source: 'SCHEDULE:RECOMMENDATION',
        profile: profileKey(type, TEAM_PROFILE),
      },
    ],
    fallbackTo: 'TRANSFER',
  };
}

function serviceRules(type: MotivationItemType): MotivationStageRule[] {
  return [
    recommendationRule(type),
    { stage: 'TRANSFER', chain: transferChain(type) },
  ];
}

const partsProfile = profileKey('PART', PARTS_PROFILE);

/** Этапы типа в порядке показа. Состав этапов и поиск адресатов не настраиваются. */
export const MOTIVATION_STAGE_RULES: Record<
  MotivationItemType,
  MotivationStageRule[]
> = {
  SERVICE: serviceRules('SERVICE'),
  CONTRACTOR: serviceRules('CONTRACTOR'),
  PART: [
    {
      // Подборщик-запчастист, иначе запчастист смены, иначе команда смены
      stage: 'PICKING',
      chain: [
        { source: 'ACTOR:PICKER', profile: partsProfile },
        { source: 'SNAPSHOT:ITEM', profile: partsProfile },
        { source: 'SCHEDULE:ITEM', profile: partsProfile },
        ...transferChain('PART'),
      ],
    },
    recommendationRule('PART'),
    { stage: 'TRANSFER', chain: transferChain('PART') },
  ],
  STORAGE: [
    {
      stage: 'CONTRACT',
      chain: [
        {
          source: 'SNAPSHOT:CONTRACT',
          profile: profileKey('STORAGE', TEAM_PROFILE),
        },
        {
          source: 'SCHEDULE:CONTRACT',
          profile: profileKey('STORAGE', TEAM_PROFILE),
        },
      ],
    },
  ],
};

/** Все профили, на которые ссылаются правила: форма показывает их даже пустыми. */
export function motivationProfileKeys(): string[] {
  return [
    ...new Set(
      Object.values(MOTIVATION_STAGE_RULES).flatMap((rules) =>
        rules.flatMap((rule) => rule.chain.map((step) => step.profile)),
      ),
    ),
  ];
}
