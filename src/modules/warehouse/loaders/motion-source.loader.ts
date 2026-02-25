import { Injectable, Scope } from '@nestjs/common';
import * as DataLoader from 'dataloader';
import { PrismaService } from 'src/prisma/prisma.service';
import { OrganizationService } from 'src/modules/organization/organization.service';
import { PersonService } from 'src/modules/person/person.service';
import { MotionSourceType as MotionSourceTypeEnum } from '../enums/motion-source-type.enum';
import { OrderSourceModel } from '../models/order-source.model';
import { IncomeSourceModel } from '../models/income-source.model';
import { ManualSourceModel } from '../models/manual-source.model';
import { InventorizationSourceModel } from '../models/inventorization-source.model';
import type { MotionSourceType } from '../unions/motion-source.union';

export interface MotionSourceKey {
  sourceType: MotionSourceTypeEnum;
  sourceId: string;
  description?: string | null;
}

@Injectable({ scope: Scope.REQUEST })
export class MotionSourceLoader {
  private loader: DataLoader<MotionSourceKey, MotionSourceType | null>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly organizationService: OrganizationService,
    private readonly personService: PersonService,
  ) {
    this.loader = new DataLoader(
      async (keys) => this.batchLoad(keys as MotionSourceKey[]),
      {
        cacheKeyFn: (key) => `${key.sourceType}:${key.sourceId}`,
      },
    );
  }

  async load(key: MotionSourceKey): Promise<MotionSourceType | null> {
    return this.loader.load(key);
  }

  private async batchLoad(
    keys: MotionSourceKey[],
  ): Promise<(MotionSourceType | null)[]> {
    const orderKeys = keys.filter(
      (k) => k.sourceType === MotionSourceTypeEnum.ORDER,
    );
    const incomeKeys = keys.filter(
      (k) => k.sourceType === MotionSourceTypeEnum.INCOME,
    );
    const manualKeys = keys.filter(
      (k) => k.sourceType === MotionSourceTypeEnum.MANUAL,
    );
    const inventorizationKeys = keys.filter(
      (k) => k.sourceType === MotionSourceTypeEnum.INVENTORIZATION,
    );

    const [orderSources, incomeSources] = await Promise.all([
      this.loadOrders(orderKeys),
      this.loadIncomes(incomeKeys),
    ]);

    const manualSources = this.loadManual(manualKeys);
    const inventorizationSources =
      this.loadInventorization(inventorizationKeys);

    const resultMap = new Map<string, MotionSourceType | null>();

    for (const [key, value] of orderSources) {
      resultMap.set(key, value);
    }
    for (const [key, value] of incomeSources) {
      resultMap.set(key, value);
    }
    for (const [key, value] of manualSources) {
      resultMap.set(key, value);
    }
    for (const [key, value] of inventorizationSources) {
      resultMap.set(key, value);
    }

    return keys.map(
      (k) => resultMap.get(`${k.sourceType}:${k.sourceId}`) ?? null,
    );
  }

  private async loadOrders(
    keys: MotionSourceKey[],
  ): Promise<Map<string, OrderSourceModel & { __type: 'ORDER' }>> {
    if (keys.length === 0) return new Map();

    const sourceIds = keys.map((k) => k.sourceId);
    const orders = await this.prisma.order.findMany({
      where: { id: { in: sourceIds } },
      select: {
        id: true,
        number: true,
        car: { select: { vehicle: { select: { name: true } } } },
      },
    });

    const orderMap = new Map(orders.map((o) => [o.id, o]));
    const result = new Map<string, OrderSourceModel & { __type: 'ORDER' }>();

    for (const key of keys) {
      const order = orderMap.get(key.sourceId);
      if (order) {
        result.set(`${MotionSourceTypeEnum.ORDER}:${key.sourceId}`, {
          __type: 'ORDER',
          orderId: order.id,
          orderNumber: order.number,
          carName: order.car?.vehicle?.name ?? null,
        });
      }
    }

    return result;
  }

  private async loadIncomes(
    keys: MotionSourceKey[],
  ): Promise<Map<string, IncomeSourceModel & { __type: 'INCOME' }>> {
    if (keys.length === 0) return new Map();

    const sourceIds = keys.map((k) => k.sourceId);

    const [incomes, incomeAccrues, incomeParts] = await Promise.all([
      this.prisma.income.findMany({
        where: { id: { in: sourceIds } },
        select: { id: true, document: true, supplierId: true },
      }),
      this.prisma.incomeAccrue.findMany({
        where: { id: { in: sourceIds } },
        select: {
          id: true,
          income: { select: { id: true, document: true, supplierId: true } },
        },
      }),
      this.prisma.incomePart.findMany({
        where: { id: { in: sourceIds } },
        select: {
          id: true,
          income: { select: { id: true, document: true, supplierId: true } },
        },
      }),
    ]);

    const incomeMap = new Map(incomes.map((i) => [i.id, i]));
    const incomeAccrueMap = new Map(
      incomeAccrues.map((ia) => [ia.id, ia.income]),
    );
    const incomePartMap = new Map(incomeParts.map((ip) => [ip.id, ip.income]));

    const supplierIds = new Set<string>();
    incomes.forEach((i) => i.supplierId && supplierIds.add(i.supplierId));
    incomeAccrues.forEach(
      (ia) => ia.income?.supplierId && supplierIds.add(ia.income.supplierId),
    );
    incomeParts.forEach(
      (ip) => ip.income?.supplierId && supplierIds.add(ip.income.supplierId),
    );

    const [orgNames, personNames] = await Promise.all([
      this.organizationService.getNamesByIds([...supplierIds]),
      this.personService.getNamesByIds([...supplierIds]),
    ]);

    const supplierNameMap = new Map<string, string>([
      ...orgNames,
      ...personNames,
    ]);

    const result = new Map<string, IncomeSourceModel & { __type: 'INCOME' }>();

    for (const key of keys) {
      const income =
        incomeMap.get(key.sourceId) ??
        incomeAccrueMap.get(key.sourceId) ??
        incomePartMap.get(key.sourceId);

      if (income) {
        const supplierName = income.supplierId
          ? supplierNameMap.get(income.supplierId)
          : null;

        result.set(`${MotionSourceTypeEnum.INCOME}:${key.sourceId}`, {
          __type: 'INCOME',
          incomeId: income.id,
          document: income.document ?? null,
          supplierId: income.supplierId ?? null,
          supplierName: supplierName ?? null,
        });
      }
    }

    return result;
  }

  private loadManual(
    keys: MotionSourceKey[],
  ): Map<string, ManualSourceModel & { __type: 'MANUAL' }> {
    const result = new Map<string, ManualSourceModel & { __type: 'MANUAL' }>();

    for (const key of keys) {
      result.set(`${MotionSourceTypeEnum.MANUAL}:${key.sourceId}`, {
        __type: 'MANUAL',
        description: key.description ?? null,
      });
    }

    return result;
  }

  private loadInventorization(
    keys: MotionSourceKey[],
  ): Map<string, InventorizationSourceModel & { __type: 'INVENTORIZATION' }> {
    const result = new Map<
      string,
      InventorizationSourceModel & { __type: 'INVENTORIZATION' }
    >();

    for (const key of keys) {
      result.set(`${MotionSourceTypeEnum.INVENTORIZATION}:${key.sourceId}`, {
        __type: 'INVENTORIZATION',
        description: key.description ?? null,
      });
    }

    return result;
  }
}
