import type { ProfitCostBasis } from 'src/modules/profit/enums/profit-cost-basis.enum';
import type {
  MotivationItemFacts,
  MotivationItemType,
  MotivationParticipant,
} from '../calculator/motivation-calculator.types';

/**
 * С этой даты график ведётся (до 15.08.2026 — с погрешностью). Позиции без снимка,
 * созданные раньше, командой не восстановить: в мотивацию они не попадают.
 */
export const MOTIVATION_SCHEDULE_START = '2026-06-01';

export type MotivationExclusionReason = 'WARRANTY' | 'BEFORE_SCHEDULE';

/** Позиция закрытого заказа в том виде, в каком её прочитали из снапшота прибыли. */
export type MotivationSourceRow = {
  /** id позиции заказа или договора хранения — ключ строк начисления. */
  itemId: string;
  orderId: string;
  orderNumber: number;
  closedAt: Date;
  kind: 'SERVICE' | 'PART' | 'STORAGE';
  contractor: boolean;
  label: string;
  profitMinor: bigint;
  costBasis: ProfitCostBasis;
  warranty: boolean;
  /** Создание позиции или договора: по нему ищется смена. */
  anchor: { createdAt: Date | null; snapshotId: string | null };
  /** null — позиция не из рекомендации. */
  recommendation: { createdAt: Date | null; snapshotId: string | null } | null;
  /** Кто подобрал запчасть: автор позиции или запчасти рекомендации. */
  picker: {
    userId: string | null;
    at: Date | null;
    snapshotId: string | null;
  } | null;
};

export type MotivationEmployee = {
  employeeId: string;
  positionIds: string[];
};

export type MotivationFactsContext = {
  /** Рабочий день момента в поясе тенанта, ГГГГ-ММ-ДД. */
  workDateOf: (at: Date) => string;
  snapshots: Map<string, MotivationParticipant[]>;
  /** Состав смены по графику; дня нет — никто не работал. */
  schedule: Map<string, MotivationParticipant[]>;
  employeeOf: (userId: string, at: Date) => MotivationEmployee | null;
};

export type MotivationFactItem = MotivationItemFacts & {
  orderId: string;
  orderNumber: number;
  closedAt: Date;
  label: string;
  /** Налоги и эквайринг. Из прибыли снапшота не вычитаются, только из базы бонуса. */
  overheadMinor: bigint;
};

export type MotivationExcludedItem = {
  itemId: string;
  orderId: string;
  orderNumber: number;
  type: MotivationItemType;
  label: string;
  profitMinor: bigint;
  reason: MotivationExclusionReason;
};

export type MotivationFacts = {
  items: MotivationFactItem[];
  excluded: MotivationExcludedItem[];
};
