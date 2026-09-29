/** Тип позиции определяет ставку фонда и набор этапов. Подряд — отдельный тип, хотя в заказе это услуга. */
export type MotivationItemType = 'SERVICE' | 'CONTRACTOR' | 'PART' | 'STORAGE';

export type MotivationStage =
  'RECOMMENDATION' | 'TRANSFER' | 'PICKING' | 'CONTRACT';

/**
 * Откуда берутся участники этапа. Калькулятор не знает, как их собрать:
 * наборы готовит сбор фактов, здесь только выбор первого подходящего.
 */
export type MotivationSourceRef =
  | 'SNAPSHOT:ITEM'
  | 'SNAPSHOT:RECOMMENDATION'
  | 'SNAPSHOT:CONTRACT'
  | 'ACTOR:PICKER'
  | 'HISTORICAL_TEAM:ITEM_AUTHOR'
  | 'HISTORICAL_TEAM:ORDER_AUTHOR';

/** Этап без адресата: доля уходит другим этапам позиции или остаётся в фонде. */
export type MotivationPolicy = 'REDISTRIBUTE' | 'KEEP_IN_FUND';

export type MotivationParticipant = {
  employeeId: string;
  positionId: string;
};

/** Вес должности; должности нет в профиле или вес 0 — она в этапе не участвует. */
export type MotivationProfile = Record<string, number>;

export type MotivationChainStep = {
  source: MotivationSourceRef;
  profile: string;
};

export type MotivationStageScheme = {
  stage: MotivationStage;
  /** Доля фонда позиции в базисных пунктах; по типу в сумме 10 000. */
  shareBp: number;
  chain: MotivationChainStep[];
  policy: MotivationPolicy;
  /**
   * Кому уходит доля при REDISTRIBUTE. Не задано или никто из списка не нашёл
   * адресата — всем этапам с адресатом пропорционально их долям.
   */
  redistributeTo?: MotivationStage[];
};

export type MotivationTypeScheme = {
  /** Ставка фонда от прибыли позиции в базисных пунктах. */
  rateBp: number;
  stages: MotivationStageScheme[];
};

export type MotivationScheme = {
  profiles: Record<string, MotivationProfile>;
  types: Record<MotivationItemType, MotivationTypeScheme>;
};

export type MotivationItemFacts = {
  itemId: string;
  type: MotivationItemType;
  /** Прибыль позиции в копейках. */
  profitMinor: bigint;
  /** Этапы, которых у позиции не было: рекомендации нет, нет закупки для подбора. */
  notApplicable?: MotivationStage[];
  /** Источник не передан — у позиции его нет, цепочка идёт дальше. */
  participants: Partial<Record<MotivationSourceRef, MotivationParticipant[]>>;
};

export type MotivationRowOutcome = 'ACCRUED' | 'KEPT_IN_FUND' | 'UNATTRIBUTED';

export type MotivationKeepReason = 'NOT_APPLICABLE' | 'NO_RECIPIENTS';

export type MotivationRow = {
  itemId: string;
  /** null только у «без атрибуции»: ни один этап позиции не нашёл адресата. */
  stage: MotivationStage | null;
  employeeId: string | null;
  positionId: string | null;
  amountMinor: bigint;
  outcome: MotivationRowOutcome;
  reason: MotivationKeepReason | null;
  source: MotivationSourceRef | null;
};

export type MotivationItemResult = {
  itemId: string;
  type: MotivationItemType;
  profitMinor: bigint;
  fundMinor: bigint;
  rows: MotivationRow[];
};
