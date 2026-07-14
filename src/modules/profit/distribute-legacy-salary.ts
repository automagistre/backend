import { OrderItemServiceKind } from 'src/modules/order/enums/order-item-service-kind.enum';
import { PartyKind } from 'src/common/party';
import { ProfitCostBasis } from './enums/profit-cost-basis.enum';

export type LegacyServiceLine = {
  orderItemId: string;
  executorId: string | null;
  executorKind: string | null;
  kind: string;
  net: bigint;
  warranty: boolean;
};

export function isLegacyContractorService(service: LegacyServiceLine): boolean {
  return (
    service.kind === OrderItemServiceKind.CONTRACTOR ||
    service.executorKind === PartyKind.ORGANIZATION
  );
}

export function isLegacyAutoservicePersonWork(
  service: LegacyServiceLine,
): boolean {
  return (
    !service.warranty &&
    !isLegacyContractorService(service) &&
    service.executorKind === PartyKind.PERSON &&
    !!service.executorId &&
    service.net > 0n
  );
}

/** Распределение фактической OrderSalary по работам персоны пропорционально net. */
export function distributeLegacySalaryCost(
  service: LegacyServiceLine,
  allServices: LegacyServiceLine[],
  salaryByPerson: Map<string, bigint>,
): { cost: bigint; costBasis: ProfitCostBasis } {
  if (service.warranty || isLegacyContractorService(service)) {
    return { cost: 0n, costBasis: ProfitCostBasis.NONE };
  }

  if (
    service.executorKind !== PartyKind.PERSON ||
    !service.executorId ||
    service.net <= 0n
  ) {
    return { cost: 0n, costBasis: ProfitCostBasis.NONE };
  }

  const salary = salaryByPerson.get(service.executorId) ?? 0n;
  if (salary <= 0n) {
    return { cost: 0n, costBasis: ProfitCostBasis.NONE };
  }

  const totalNet = allServices
    .filter(
      (line) =>
        line.executorId === service.executorId &&
        isLegacyAutoservicePersonWork(line),
    )
    .reduce((sum, line) => sum + line.net, 0n);

  if (totalNet <= 0n) {
    return { cost: 0n, costBasis: ProfitCostBasis.NONE };
  }

  const cost = (salary * service.net) / totalNet;
  return { cost, costBasis: ProfitCostBasis.SALARY };
}
