import { splitLargestRemainder } from './largest-remainder';
import type {
  MotivationItemFacts,
  MotivationItemResult,
  MotivationKeepReason,
  MotivationParticipant,
  MotivationProfile,
  MotivationRow,
  MotivationScheme,
  MotivationSourceRef,
  MotivationStage,
  MotivationStageScheme,
} from './motivation-calculator.types';

const BASIS_POINTS = 10_000;

type StageResolution =
  | {
      stage: MotivationStageScheme;
      recipients: MotivationParticipant[];
      profile: MotivationProfile;
      source: MotivationSourceRef;
    }
  | {
      stage: MotivationStageScheme;
      recipients: null;
      reason: MotivationKeepReason;
    };

export function calculateMotivation(
  items: MotivationItemFacts[],
  scheme: MotivationScheme,
): MotivationItemResult[] {
  assertValidScheme(scheme);
  return items.map((item) => calculateItem(item, scheme));
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

export function assertValidScheme(scheme: MotivationScheme): void {
  for (const [name, profile] of Object.entries(scheme.profiles)) {
    for (const weight of Object.values(profile)) {
      if (!Number.isInteger(weight) || weight < 0) {
        throw new Error(`Профиль «${name}»: вес должности — целое число от 0`);
      }
    }
  }

  for (const [type, typeScheme] of Object.entries(scheme.types)) {
    if (!isBasisPoints(typeScheme.rateBp)) {
      throw new Error(`${type}: ставка фонда вне диапазона 0–10 000 б.п.`);
    }
    const seen = new Set<MotivationStage>();
    let shareSum = 0;
    for (const stage of typeScheme.stages) {
      if (seen.has(stage.stage)) {
        throw new Error(`${type}: этап ${stage.stage} указан дважды`);
      }
      seen.add(stage.stage);
      // Доля 0 не даёт этапу веса при перераспределении — такой этап лучше убрать
      if (!isBasisPoints(stage.shareBp) || stage.shareBp === 0) {
        throw new Error(`${type}: доля этапа ${stage.stage} вне 1–10 000 б.п.`);
      }
      shareSum += stage.shareBp;
      for (const step of stage.chain) {
        if (!scheme.profiles[step.profile]) {
          throw new Error(
            `${type}: этап ${stage.stage} ссылается на неизвестный профиль «${step.profile}»`,
          );
        }
      }
    }
    for (const stage of typeScheme.stages) {
      const unknown = stage.redistributeTo?.find((target) => !seen.has(target));
      if (unknown) {
        throw new Error(
          `${type}: этап ${stage.stage} перераспределяет в отсутствующий этап ${unknown}`,
        );
      }
    }
    if (shareSum !== BASIS_POINTS) {
      throw new Error(`${type}: доли этапов в сумме ${shareSum}, нужно 10 000`);
    }
  }
}

function calculateItem(
  facts: MotivationItemFacts,
  scheme: MotivationScheme,
): MotivationItemResult {
  const typeScheme = scheme.types[facts.type];
  // Убыточная позиция фонда не даёт, но и не забирает у остальных
  const fundMinor =
    facts.profitMinor > 0n
      ? (facts.profitMinor * BigInt(typeScheme.rateBp)) / BigInt(BASIS_POINTS)
      : 0n;
  const result: MotivationItemResult = {
    itemId: facts.itemId,
    type: facts.type,
    profitMinor: facts.profitMinor,
    fundMinor,
    rows: [],
  };
  if (fundMinor === 0n) return result;

  const stageAmounts = splitLargestRemainder(
    fundMinor,
    typeScheme.stages.map((stage) => ({
      key: stage.stage,
      weight: BigInt(stage.shareBp),
    })),
  );
  const resolutions = typeScheme.stages.map((stage) =>
    resolveStage(stage, facts, scheme),
  );
  const resolved = resolutions.filter(
    (resolution) => resolution.recipients !== null,
  );

  if (resolved.length === 0) {
    result.rows.push({
      itemId: facts.itemId,
      stage: null,
      employeeId: null,
      positionId: null,
      amountMinor: fundMinor,
      outcome: 'UNATTRIBUTED',
      reason: null,
      source: null,
    });
    return result;
  }

  const extra = new Map<MotivationStage, bigint>();
  for (const resolution of resolutions) {
    if (
      resolution.recipients !== null ||
      resolution.stage.policy !== 'REDISTRIBUTE'
    ) {
      continue;
    }
    const targets = redistributionTargets(resolution.stage, resolved);
    const shares = splitLargestRemainder(
      stageAmounts.get(resolution.stage.stage)!,
      targets.map((target) => ({
        key: target.stage.stage,
        weight: BigInt(target.stage.shareBp),
      })),
    );
    for (const [stage, amount] of shares) {
      extra.set(stage, (extra.get(stage) ?? 0n) + amount);
    }
  }

  for (const resolution of resolutions) {
    const amount = stageAmounts.get(resolution.stage.stage)!;
    if (resolution.recipients) {
      const total = amount + (extra.get(resolution.stage.stage) ?? 0n);
      result.rows.push(...distributeStage(facts.itemId, total, resolution));
    } else if (resolution.stage.policy === 'KEEP_IN_FUND') {
      result.rows.push({
        itemId: facts.itemId,
        stage: resolution.stage.stage,
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

function redistributionTargets(
  stage: MotivationStageScheme,
  resolved: StageResolution[],
): StageResolution[] {
  const preferred = stage.redistributeTo
    ? resolved.filter((target) =>
        stage.redistributeTo!.includes(target.stage.stage),
      )
    : [];
  return preferred.length > 0 ? preferred : resolved;
}

function resolveStage(
  stage: MotivationStageScheme,
  facts: MotivationItemFacts,
  scheme: MotivationScheme,
): StageResolution {
  if (facts.notApplicable?.includes(stage.stage)) {
    return { stage, recipients: null, reason: 'NOT_APPLICABLE' };
  }
  for (const step of stage.chain) {
    const candidates = facts.participants[step.source];
    if (!candidates) continue;
    const profile = scheme.profiles[step.profile];
    const recipients = uniqueParticipants(candidates).filter(
      (participant) => (profile[participant.positionId] ?? 0) > 0,
    );
    if (recipients.length > 0) {
      return { stage, recipients, profile, source: step.source };
    }
  }
  return { stage, recipients: null, reason: 'NO_RECIPIENTS' };
}

/** Этап → котлы присутствующих должностей по весам → поровну между людьми должности. */
function distributeStage(
  itemId: string,
  total: bigint,
  resolution: Extract<StageResolution, { recipients: MotivationParticipant[] }>,
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
      rows.push({
        itemId,
        stage: resolution.stage.stage,
        employeeId,
        positionId,
        amountMinor,
        outcome: 'ACCRUED',
        reason: null,
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

function isBasisPoints(value: number): boolean {
  return Number.isInteger(value) && value >= 0 && value <= BASIS_POINTS;
}
