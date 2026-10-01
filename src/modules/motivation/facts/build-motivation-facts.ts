import { ProfitCostBasis } from 'src/modules/profit/enums/profit-cost-basis.enum';
import type {
  MotivationItemFacts,
  MotivationItemType,
  MotivationParticipant,
  MotivationStage,
} from '../calculator/motivation-calculator.types';
import {
  MOTIVATION_SCHEDULE_START,
  type MotivationFacts,
  type MotivationFactsContext,
  type MotivationSourceRow,
} from './motivation-facts.types';

function itemType(row: MotivationSourceRow): MotivationItemType {
  if (row.kind === 'STORAGE') return 'STORAGE';
  if (row.kind === 'PART') return 'PART';
  return row.contractor ? 'CONTRACTOR' : 'SERVICE';
}

/** Состав графика на момент; до начала графика — неизвестен. */
function scheduleAt(
  at: Date | null,
  ctx: MotivationFactsContext,
): MotivationParticipant[] | null {
  if (!at) return null;
  const workDate = ctx.workDateOf(at);
  if (workDate < MOTIVATION_SCHEDULE_START) return null;
  return ctx.schedule.get(workDate) ?? [];
}

/**
 * Подборщик — все его пары в смене того дня. Вне смены или без данных о смене —
 * все его должности: подбор персональный и от графика не зависит.
 */
function pickerPairs(
  picker: NonNullable<MotivationSourceRow['picker']>,
  ctx: MotivationFactsContext,
): MotivationParticipant[] {
  if (!picker.userId || !picker.at) return [];
  const employee = ctx.employeeOf(picker.userId, picker.at);
  if (!employee) return [];

  const shift =
    (picker.snapshotId ? ctx.snapshots.get(picker.snapshotId) : undefined) ??
    scheduleAt(picker.at, ctx) ??
    [];
  const inShift = shift.filter(
    (pair) => pair.employeeId === employee.employeeId,
  );
  if (inShift.length) return inShift;
  return employee.positionIds.map((positionId) => ({
    employeeId: employee.employeeId,
    positionId,
  }));
}

export function buildMotivationFacts(
  rows: MotivationSourceRow[],
  ctx: MotivationFactsContext,
): MotivationFacts {
  const result: MotivationFacts = { items: [], excluded: [] };

  for (const row of rows) {
    const type = itemType(row);
    const exclude = (reason: 'WARRANTY' | 'BEFORE_SCHEDULE') =>
      result.excluded.push({
        itemId: row.itemId,
        orderId: row.orderId,
        orderNumber: row.orderNumber,
        type,
        label: row.label,
        profitMinor: row.profitMinor,
        reason,
      });

    if (row.warranty) {
      exclude('WARRANTY');
      continue;
    }

    const storage = type === 'STORAGE';
    const participants: MotivationItemFacts['participants'] = {};
    const anchorSnapshot = row.anchor.snapshotId
      ? ctx.snapshots.get(row.anchor.snapshotId)
      : undefined;
    if (anchorSnapshot) {
      participants[storage ? 'SNAPSHOT:CONTRACT' : 'SNAPSHOT:ITEM'] =
        anchorSnapshot;
    } else {
      const schedule = scheduleAt(row.anchor.createdAt, ctx);
      if (!schedule) {
        exclude('BEFORE_SCHEDULE');
        continue;
      }
      participants[storage ? 'SCHEDULE:CONTRACT' : 'SCHEDULE:ITEM'] = schedule;
    }

    const notApplicable: MotivationStage[] = [];
    if (!storage) {
      if (!row.recommendation) {
        notApplicable.push('RECOMMENDATION');
      } else {
        const members = row.recommendation.snapshotId
          ? ctx.snapshots.get(row.recommendation.snapshotId)
          : undefined;
        if (members) {
          participants['SNAPSHOT:RECOMMENDATION'] = members;
        } else {
          // До начала графика состав не восстановить — доля уйдёт по политике этапа
          const schedule = scheduleAt(row.recommendation.createdAt, ctx);
          if (schedule) participants['SCHEDULE:RECOMMENDATION'] = schedule;
        }
      }
    }
    if (type === 'PART') {
      if (row.costBasis !== ProfitCostBasis.LAST_INCOME) {
        notApplicable.push('PICKING');
      } else if (row.picker) {
        participants['ACTOR:PICKER'] = pickerPairs(row.picker, ctx);
      }
    }

    result.items.push({
      itemId: row.itemId,
      type,
      profitMinor: row.profitMinor,
      overheadMinor: 0n,
      ...(notApplicable.length ? { notApplicable } : {}),
      participants,
      orderId: row.orderId,
      orderNumber: row.orderNumber,
      closedAt: row.closedAt,
      label: row.label,
    });
  }

  return result;
}
