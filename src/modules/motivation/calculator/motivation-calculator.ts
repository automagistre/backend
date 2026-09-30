import { splitLargestRemainder } from './largest-remainder';
import type {
  MotivationCalculationOptions,
  MotivationItemFacts,
  MotivationItemResult,
  MotivationItemType,
  MotivationKeepReason,
  MotivationParticipant,
  MotivationProfile,
  MotivationRow,
  MotivationScheme,
  MotivationSourceRef,
  MotivationStage,
} from './motivation-calculator.types';
import {
  MOTIVATION_STAGE_RULES,
  type MotivationStageRule,
} from './motivation-stages';

const BASIS_POINTS = 10_000;

type StageResolution =
  | {
      rule: MotivationStageRule;
      recipients: MotivationParticipant[];
      profile: MotivationProfile;
      source: MotivationSourceRef;
    }
  | {
      rule: MotivationStageRule;
      recipients: null;
      reason: MotivationKeepReason;
    };

export function calculateMotivation(
  items: MotivationItemFacts[],
  scheme: MotivationScheme,
  options: MotivationCalculationOptions = {},
): MotivationItemResult[] {
  assertValidScheme(scheme);
  const kept = keptEmployees(options);
  return items.map((item) => calculateItem(item, scheme, kept));
}

/** Увольнение важнее «только оклада». */
function keptEmployees(
  options: MotivationCalculationOptions,
): Map<string, MotivationKeepReason> {
  const kept = new Map<string, MotivationKeepReason>();
  for (const id of options.salaryOnlyEmployeeIds ?? []) {
    kept.set(id, 'SALARY_ONLY');
  }
  for (const id of options.firedEmployeeIds ?? []) kept.set(id, 'FIRED');
  return kept;
}

export function motivationTotalsByEmployee(
  results: MotivationItemResult[],
): Map<string, bigint> {
  const totals = new Map<string, bigint>();
  for (const row of results.flatMap((result) => result.rows)) {
    if (row.outcome !== 'ACCRUED' || !row.employeeId) continue;
    totals.set(
      row.employeeId,
      (totals.get(row.employeeId) ?? 0n) + row.amountMinor,
    );
  }
  return totals;
}

/** Фонд позиции — сумма долей её этапов, базисные пункты прибыли. */
export function motivationFundRateBp(
  scheme: MotivationScheme,
  type: MotivationItemType,
): number {
  return Object.values(scheme.rates[type]).reduce(
    (sum, rate) => sum + (rate ?? 0),
    0,
  );
}

export function assertValidScheme(scheme: MotivationScheme): void {
  for (const [name, profile] of Object.entries(scheme.profiles)) {
    for (const weight of Object.values(profile)) {
      if (!Number.isInteger(weight) || weight < 0) {
        throw new Error(`Профиль «${name}»: вес должности — целое число от 0`);
      }
    }
  }

  for (const [type, rules] of Object.entries(MOTIVATION_STAGE_RULES)) {
    const rates = scheme.rates[type as MotivationItemType];
    if (!rates) throw new Error(`${type}: нет долей этапов`);
    const known = new Set(rules.map((rule) => rule.stage));
    for (const [stage, rate] of Object.entries(rates)) {
      if (!known.has(stage as MotivationStage)) {
        throw new Error(`${type}: у типа нет этапа ${stage}`);
      }
      if (rate === undefined || !Number.isInteger(rate) || rate < 0) {
        throw new Error(`${type}: доля этапа ${stage} — целое число от 0`);
      }
    }
    const fund = motivationFundRateBp(scheme, type as MotivationItemType);
    if (fund > BASIS_POINTS) {
      throw new Error(`${type}: этапы в сумме больше 100% прибыли`);
    }
  }
}

function calculateItem(
  facts: MotivationItemFacts,
  scheme: MotivationScheme,
  kept: ReadonlyMap<string, MotivationKeepReason>,
): MotivationItemResult {
  const rates = scheme.rates[facts.type];
  const rules = MOTIVATION_STAGE_RULES[facts.type].filter(
    (rule) => (rates[rule.stage] ?? 0) > 0,
  );
  const rateBp = motivationFundRateBp(scheme, facts.type);
  // Убыточная позиция фонда не даёт, но и не забирает у остальных
  const fundMinor =
    facts.profitMinor > 0n
      ? (facts.profitMinor * BigInt(rateBp)) / BigInt(BASIS_POINTS)
      : 0n;
  const result: MotivationItemResult = {
    itemId: facts.itemId,
    type: facts.type,
    profitMinor: facts.profitMinor,
    fundMinor,
    rows: [],
  };
  if (fundMinor === 0n) return result;

  const amounts = splitLargestRemainder(
    fundMinor,
    rules.map((rule) => ({
      key: rule.stage,
      weight: BigInt(rates[rule.stage]!),
    })),
  );
  const resolutions = rules.map((rule) => resolveStage(rule, facts, scheme));

  for (const resolution of resolutions) {
    const target = resolution.rule.fallbackTo;
    if (resolution.recipients !== null || !target) continue;
    const hasRecipients = resolutions.some(
      (other) => other.rule.stage === target && other.recipients !== null,
    );
    if (!hasRecipients) continue;
    const stage = resolution.rule.stage;
    amounts.set(target, amounts.get(target)! + amounts.get(stage)!);
    amounts.set(stage, 0n);
  }

  for (const resolution of resolutions) {
    const amount = amounts.get(resolution.rule.stage)!;
    if (amount === 0n) continue;
    if (resolution.recipients) {
      result.rows.push(
        ...distributeStage(facts.itemId, amount, resolution, kept),
      );
    } else {
      result.rows.push({
        itemId: facts.itemId,
        stage: resolution.rule.stage,
        employeeId: null,
        positionId: null,
        amountMinor: amount,
        outcome: 'KEPT_IN_FUND',
        reason: resolution.reason,
        source: null,
      });
    }
  }
  return result;
}

function resolveStage(
  rule: MotivationStageRule,
  facts: MotivationItemFacts,
  scheme: MotivationScheme,
): StageResolution {
  if (facts.notApplicable?.includes(rule.stage)) {
    return { rule, recipients: null, reason: 'NOT_APPLICABLE' };
  }
  for (const step of rule.chain) {
    const candidates = facts.participants[step.source];
    if (!candidates) continue;
    const profile = scheme.profiles[step.profile] ?? {};
    const recipients = uniqueParticipants(candidates).filter(
      (participant) => (profile[participant.positionId] ?? 0) > 0,
    );
    if (recipients.length > 0) {
      return { rule, recipients, profile, source: step.source };
    }
  }
  return { rule, recipients: null, reason: 'NO_RECIPIENTS' };
}

/** Этап → котлы присутствующих должностей по весам → поровну между людьми должности. */
function distributeStage(
  itemId: string,
  total: bigint,
  resolution: Extract<StageResolution, { recipients: MotivationParticipant[] }>,
  kept: ReadonlyMap<string, MotivationKeepReason>,
): MotivationRow[] {
  const positionIds = [
    ...new Set(resolution.recipients.map((recipient) => recipient.positionId)),
  ].sort(compareIds);
  const pots = splitLargestRemainder(
    total,
    positionIds.map((positionId) => ({
      key: positionId,
      weight: BigInt(resolution.profile[positionId]),
    })),
  );

  const rows: MotivationRow[] = [];
  for (const positionId of positionIds) {
    const people = resolution.recipients
      .filter((recipient) => recipient.positionId === positionId)
      .map((recipient) => recipient.employeeId)
      .sort(compareIds);
    const shares = splitLargestRemainder(
      pots.get(positionId)!,
      people.map((employeeId) => ({ key: employeeId, weight: 1n })),
    );
    for (const employeeId of people) {
      const amountMinor = shares.get(employeeId)!;
      if (amountMinor === 0n) continue;
      const reason = kept.get(employeeId) ?? null;
      rows.push({
        itemId,
        stage: resolution.rule.stage,
        employeeId,
        positionId,
        amountMinor,
        outcome: reason ? 'KEPT_IN_FUND' : 'ACCRUED',
        reason,
        source: resolution.source,
      });
    }
  }
  return rows;
}

function uniqueParticipants(
  participants: MotivationParticipant[],
): MotivationParticipant[] {
  const byKey = new Map<string, MotivationParticipant>();
  for (const participant of participants) {
    byKey.set(
      `${participant.employeeId}:${participant.positionId}`,
      participant,
    );
  }
  return [...byKey.values()];
}

function compareIds(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
