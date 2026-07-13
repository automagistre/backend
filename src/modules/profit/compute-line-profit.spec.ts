import { WarrantyPayer } from 'src/modules/order/enums/warranty-payer.enum';
import { ProfitLineKind } from './enums/profit-line-kind.enum';
import { computeLineProfit } from './compute-line-profit';

describe('computeLineProfit', () => {
  it('AUTOSERVICE без гарантии: profit = revenue − cost', () => {
    expect(
      computeLineProfit({
        kind: ProfitLineKind.SERVICE,
        revenue: 10000n,
        cost: 3000n,
        warranty: false,
      }),
    ).toEqual({
      revenueAmount: 10000n,
      costAmount: 3000n,
      profitAmount: 7000n,
    });
  });

  it('подрядчик без гарантии: profit = revenue − costAmount', () => {
    expect(
      computeLineProfit({
        kind: ProfitLineKind.SERVICE,
        revenue: 100000n,
        cost: 80000n,
        warranty: false,
      }),
    ).toEqual({
      revenueAmount: 100000n,
      costAmount: 80000n,
      profitAmount: 20000n,
    });
  });

  it('запчасть без гарантии: profit = revenue − COGS', () => {
    expect(
      computeLineProfit({
        kind: ProfitLineKind.PART,
        revenue: 15000n,
        cost: 9000n,
        warranty: false,
      }),
    ).toEqual({
      revenueAmount: 15000n,
      costAmount: 9000n,
      profitAmount: 6000n,
    });
  });

  it('гарантия работа EXECUTOR: profit = 0', () => {
    expect(
      computeLineProfit({
        kind: ProfitLineKind.SERVICE,
        revenue: 10000n,
        cost: 3000n,
        warranty: true,
        warrantyPayer: WarrantyPayer.EXECUTOR,
      }),
    ).toEqual({
      revenueAmount: 0n,
      costAmount: 0n,
      profitAmount: 0n,
    });
  });

  it('гарантия работа ORGANIZATION: profit = −cost', () => {
    expect(
      computeLineProfit({
        kind: ProfitLineKind.SERVICE,
        revenue: 10000n,
        cost: 80000n,
        warranty: true,
        warrantyPayer: WarrantyPayer.ORGANIZATION,
      }),
    ).toEqual({
      revenueAmount: 0n,
      costAmount: 80000n,
      profitAmount: -80000n,
    });
  });

  it('гарантия запчасть: всегда profit = −закупка', () => {
    expect(
      computeLineProfit({
        kind: ProfitLineKind.PART,
        revenue: 10000n,
        cost: 5000n,
        warranty: true,
        warrantyPayer: WarrantyPayer.EXECUTOR,
      }),
    ).toEqual({
      revenueAmount: 0n,
      costAmount: 5000n,
      profitAmount: -5000n,
    });
  });

  it('нет закупки (cost=0): profit = revenue', () => {
    expect(
      computeLineProfit({
        kind: ProfitLineKind.PART,
        revenue: 10000n,
        cost: 0n,
        warranty: false,
      }),
    ).toEqual({
      revenueAmount: 10000n,
      costAmount: 0n,
      profitAmount: 10000n,
    });
  });

  it('нулевая выручка: profit = −cost', () => {
    expect(
      computeLineProfit({
        kind: ProfitLineKind.SERVICE,
        revenue: 0n,
        cost: 0n,
        warranty: false,
      }),
    ).toEqual({
      revenueAmount: 0n,
      costAmount: 0n,
      profitAmount: 0n,
    });
  });
});
