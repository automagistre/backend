import type { PrismaService } from 'src/prisma/prisma.service';
import type {
  MotivationKeepReason,
  MotivationRowOutcome,
  MotivationSourceRef,
  MotivationStage,
} from '../calculator/motivation-calculator.types';
import type { MotivationExcludedItem } from '../facts/motivation-facts.types';
import type {
  MotivationBreakdownRowModel,
  MotivationExcludedItemModel,
} from './motivation-breakdown.model';
import {
  MotivationExclusionReasonEnum,
  MotivationItemTypeEnum,
  MotivationKeepReasonEnum,
  MotivationRowOutcomeEnum,
  MotivationStageEnum,
} from './motivation.enums';

export type MotivationNames = {
  employees: Map<string, string>;
  positions: Map<string, string>;
};

/** Строка расшифровки: из калькулятора или из сохранённого начисления. */
export type MotivationRowLike = {
  stage: MotivationStage;
  employeeId: string | null;
  positionId: string | null;
  amountMinor: bigint;
  outcome: MotivationRowOutcome;
  reason: MotivationKeepReason | null;
  source: MotivationSourceRef | null;
};

export async function loadMotivationNames(
  prisma: PrismaService,
  tenantId: string,
): Promise<MotivationNames> {
  const [employees, positions] = await Promise.all([
    prisma.employee.findMany({
      where: { tenantId },
      select: {
        id: true,
        person: { select: { lastname: true, firstname: true } },
      },
    }),
    prisma.staffPosition.findMany({
      where: { tenantId },
      select: { id: true, name: true },
    }),
  ]);
  return {
    employees: new Map(
      employees.map((employee) => [
        employee.id,
        [employee.person.lastname, employee.person.firstname]
          .filter(Boolean)
          .join(' ') || 'Без имени',
      ]),
    ),
    positions: new Map(
      positions.map((position) => [position.id, position.name]),
    ),
  };
}

export function employeeName(names: MotivationNames, employeeId: string) {
  return names.employees.get(employeeId) ?? 'Без имени';
}

export function toBreakdownRow(
  row: MotivationRowLike,
  names: MotivationNames,
): MotivationBreakdownRowModel {
  return {
    stage: row.stage as MotivationStageEnum,
    employeeId: row.employeeId,
    employeeName: row.employeeId ? employeeName(names, row.employeeId) : null,
    positionId: row.positionId,
    positionName: row.positionId
      ? (names.positions.get(row.positionId) ?? null)
      : null,
    amount: row.amountMinor,
    outcome: row.outcome as MotivationRowOutcomeEnum,
    reason: row.reason as MotivationKeepReasonEnum | null,
    source: row.source,
  };
}

export function toExcludedItem(
  item: MotivationExcludedItem,
): MotivationExcludedItemModel {
  return {
    itemId: item.itemId,
    type: item.type as MotivationItemTypeEnum,
    label: item.label,
    profit: item.profitMinor,
    reason: item.reason as MotivationExclusionReasonEnum,
  };
}
