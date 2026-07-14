import { ProfitLineKind } from './enums/profit-line-kind.enum';

export type OrderProfitRow = {
  kind: string;
  revenueAmount: bigint;
  costAmount: bigint;
  profitAmount: bigint;
};

export type OrderProfitTotals = {
  revenueAmount: bigint;
  costAmount: bigint;
  profitAmount: bigint;
  worksRevenueAmount: bigint;
  worksCostAmount: bigint;
  worksProfitAmount: bigint;
  partsRevenueAmount: bigint;
  partsCostAmount: bigint;
  partsProfitAmount: bigint;
};

export function aggregateOrderProfit(
  rows: OrderProfitRow[],
): OrderProfitTotals {
  const totals: OrderProfitTotals = {
    revenueAmount: 0n,
    costAmount: 0n,
    profitAmount: 0n,
    worksRevenueAmount: 0n,
    worksCostAmount: 0n,
    worksProfitAmount: 0n,
    partsRevenueAmount: 0n,
    partsCostAmount: 0n,
    partsProfitAmount: 0n,
  };

  for (const row of rows) {
    totals.revenueAmount += row.revenueAmount;
    totals.costAmount += row.costAmount;
    totals.profitAmount += row.profitAmount;

    if (row.kind === ProfitLineKind.SERVICE) {
      totals.worksRevenueAmount += row.revenueAmount;
      totals.worksCostAmount += row.costAmount;
      totals.worksProfitAmount += row.profitAmount;
    } else if (row.kind === ProfitLineKind.PART) {
      totals.partsRevenueAmount += row.revenueAmount;
      totals.partsCostAmount += row.costAmount;
      totals.partsProfitAmount += row.profitAmount;
    }
  }

  return totals;
}
