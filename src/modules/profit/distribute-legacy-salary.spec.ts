import { ProfitCostBasis } from './enums/profit-cost-basis.enum';
import {
  distributeLegacySalaryCost,
  type LegacyServiceLine,
} from './distribute-legacy-salary';

describe('distributeLegacySalaryCost', () => {
  const salaryByPerson = new Map<string, bigint>([
    ['person-1', 3000n],
  ]);

  const lines: LegacyServiceLine[] = [
    {
      orderItemId: 'a',
      executorId: 'person-1',
      executorKind: 'PERSON',
      kind: 'AUTOSERVICE',
      net: 10000n,
      warranty: false,
    },
    {
      orderItemId: 'b',
      executorId: 'person-1',
      executorKind: 'PERSON',
      kind: 'AUTOSERVICE',
      net: 5000n,
      warranty: false,
    },
  ];

  it('распределяет OrderSalary пропорционально net', () => {
    const result = distributeLegacySalaryCost(lines[0], lines, salaryByPerson);
    expect(result).toEqual({
      cost: 2000n,
      costBasis: ProfitCostBasis.SALARY,
    });
  });

  it('подрядчик (ORGANIZATION) — cost=0', () => {
    const contractor: LegacyServiceLine = {
      orderItemId: 'c',
      executorId: 'org-1',
      executorKind: 'ORGANIZATION',
      kind: 'AUTOSERVICE',
      net: 80000n,
      warranty: false,
    };
    expect(
      distributeLegacySalaryCost(contractor, [contractor], salaryByPerson),
    ).toEqual({ cost: 0n, costBasis: ProfitCostBasis.NONE });
  });

  it('гарантия — cost=0', () => {
    const warranty: LegacyServiceLine = {
      ...lines[0],
      warranty: true,
    };
    expect(
      distributeLegacySalaryCost(warranty, lines, salaryByPerson),
    ).toEqual({ cost: 0n, costBasis: ProfitCostBasis.NONE });
  });

  it('нет OrderSalary — cost=0', () => {
    expect(
      distributeLegacySalaryCost(lines[0], lines, new Map()),
    ).toEqual({ cost: 0n, costBasis: ProfitCostBasis.NONE });
  });
});
