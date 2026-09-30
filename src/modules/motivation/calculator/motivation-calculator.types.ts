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
  | 'SCHEDULE:ITEM'
  | 'SCHEDULE:RECOMMENDATION'
  | 'SCHEDULE:CONTRACT';

export type MotivationParticipant = {
  employeeId: string;
  positionId: string;
};

/** Вес должности; должности нет в профиле или вес 0 — она в этапе не участвует. */
export type MotivationProfile = Record<string, number>;

/** Доля прибыли позиции за этап, базисные пункты; этапа нет или 0 — за него не платят. */
export type MotivationStageRates = Partial<Record<MotivationStage, number>>;

/**
 * Настраиваемая часть: сколько платить за этапы и как делить между должностями.
 * Кого ищет этап и куда уходит доля без адресата — правила в коде (motivation-stages).
 */
export type MotivationScheme = {
  profiles: Record<string, MotivationProfile>;
  rates: Record<MotivationItemType, MotivationStageRates>;
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

/** Не начислено — доля остаётся организации, причина в reason. */
export type MotivationRowOutcome = 'ACCRUED' | 'KEPT_IN_FUND';

export type MotivationKeepReason = 'NOT_APPLICABLE' | 'NO_RECIPIENTS' | 'FIRED';

export type MotivationCalculationOptions = {
  /** Уволенные делят фонд наравне со всеми, но их доля остаётся организации. */
  firedEmployeeIds?: ReadonlySet<string>;
};

export type MotivationRow = {
  itemId: string;
  stage: MotivationStage;
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
