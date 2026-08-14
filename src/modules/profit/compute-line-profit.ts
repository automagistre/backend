import { WarrantyPayerKind } from 'src/modules/order/enums/warranty-payer-kind.enum';
import { ProfitLineKind } from './enums/profit-line-kind.enum';

export type ComputeLineProfitInput = {
  kind: ProfitLineKind;
  revenue: bigint;
  cost: bigint;
  warranty: boolean;
  warrantyPayerKind?: string | null;
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
 * Гарантия: если плательщик — сотрудник, cost не идёт в прибыль заказа
 * (удержание/компенсация отдельными проводками). Только ORGANIZATION
 * реально уменьшает прибыль.
 */
export function computeLineProfit(
  input: ComputeLineProfitInput,
): LineProfitAmounts {
  const { revenue, cost, warranty, warrantyPayerKind } = input;

  if (!warranty) {
    return {
      revenueAmount: revenue,
      costAmount: cost,
      profitAmount: revenue - cost,
    };
  }

  if (warrantyPayerKind !== WarrantyPayerKind.ORGANIZATION) {
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
