import { WarrantyPayer } from 'src/modules/order/enums/warranty-payer.enum';
import { ProfitLineKind } from './enums/profit-line-kind.enum';

export type ComputeLineProfitInput = {
  kind: ProfitLineKind;
  revenue: bigint;
  cost: bigint;
  warranty: boolean;
  warrantyPayer?: string | null;
};

export type LineProfitAmounts = {
  revenueAmount: bigint;
  costAmount: bigint;
  profitAmount: bigint;
};

/**
 * Чистая функция расчёта прибыли по одной позиции.
 * Не знает об источнике cost — только revenue/cost/warranty.
 *
 * @see profit_calculation_system_e9c1f217.plan.md §2
 */
export function computeLineProfit(
  input: ComputeLineProfitInput,
): LineProfitAmounts {
  const { kind, revenue, cost, warranty, warrantyPayer } = input;

  if (!warranty) {
    return {
      revenueAmount: revenue,
      costAmount: cost,
      profitAmount: revenue - cost,
    };
  }

  if (kind === ProfitLineKind.PART) {
    return {
      revenueAmount: 0n,
      costAmount: cost,
      profitAmount: -cost,
    };
  }

  if (warrantyPayer === WarrantyPayer.EXECUTOR) {
    return {
      revenueAmount: 0n,
      costAmount: 0n,
      profitAmount: 0n,
    };
  }

  return {
    revenueAmount: 0n,
    costAmount: cost,
    profitAmount: -cost,
  };
}
