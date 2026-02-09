import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { TenantService } from 'src/common/services/tenant.service';
import { Organization, Person } from '@prisma/client';

export type CounterpartyItem = Person | Organization;

const DEFAULT_TAKE = 25;
const FETCH_LIMIT = 500;

function personDisplayName(p: Person): string {
  return [p.lastname, p.firstname].filter(Boolean).join(' ') || p.id;
}

function buildPersonSearchWhere(search: string | undefined) {
  if (!search?.trim()) return {};
  const terms = search.trim().split(/\s+/).filter((t) => t.length > 0);
  return {
    AND: terms.map((term) => ({
      OR: [
        { firstname: { contains: term, mode: 'insensitive' as const } },
        { lastname: { contains: term, mode: 'insensitive' as const } },
        { telephone: { contains: term, mode: 'insensitive' as const } },
        { officePhone: { contains: term, mode: 'insensitive' as const } },
        { email: { contains: term, mode: 'insensitive' as const } },
      ],
    })),
  };
}

function buildOrganizationSearchWhere(search: string | undefined) {
  if (!search?.trim()) return {};
  const term = search.trim();
  return {
    OR: [
      { name: { contains: term, mode: 'insensitive' as const } },
      { address: { contains: term, mode: 'insensitive' as const } },
      { email: { contains: term, mode: 'insensitive' as const } },
      { telephone: { contains: term, mode: 'insensitive' as const } },
      { requisiteInn: { contains: term, mode: 'insensitive' as const } },
      { requisiteOgrn: { contains: term, mode: 'insensitive' as const } },
    ],
  };
}

// TODO: нужно избавиться от сотрудников "подрядчиков", а также же разделить подрядчиков по сервисам.
@Injectable()
export class SupplierService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantService: TenantService,
  ) {}

  /** Популярность поставщиков в рамках текущего тенанта. */
  private async getSupplierUsageCounts(
    ids: string[],
    tenantId: string,
  ): Promise<Map<string, number>> {
    if (ids.length === 0) return new Map();
    const [incomeCounts, partSupplyCounts, orderItemParts] = await Promise.all([
      this.prisma.income.groupBy({
        by: ['supplierId'],
        _count: { supplierId: true },
        where: { supplierId: { in: ids }, tenantId },
      }),
      this.prisma.partSupply.groupBy({
        by: ['supplierId'],
        _count: { supplierId: true },
        where: { supplierId: { in: ids }, tenantId },
      }),
      this.prisma.orderItemPart.findMany({
        where: { supplierId: { in: ids }, orderItem: { tenantId } },
        select: { supplierId: true },
      }),
    ]);
    const map = new Map<string, number>();
    for (const id of ids) map.set(id, 0);
    for (const row of incomeCounts) map.set(row.supplierId, (map.get(row.supplierId) ?? 0) + row._count.supplierId);
    for (const row of partSupplyCounts) map.set(row.supplierId, (map.get(row.supplierId) ?? 0) + row._count.supplierId);
    for (const row of orderItemParts) {
      if (row.supplierId != null) map.set(row.supplierId, (map.get(row.supplierId) ?? 0) + 1);
    }
    return map;
  }

  /** Популярность подрядчиков в рамках текущего тенанта — по числу работ (OrderItemService.workerId). */
  private async getContractorUsageCounts(
    ids: string[],
    tenantId: string,
  ): Promise<Map<string, number>> {
    if (ids.length === 0) return new Map();
    const rows = await this.prisma.orderItemService.findMany({
      where: { workerId: { in: ids }, orderItem: { tenantId } },
      select: { workerId: true },
    });
    const map = new Map<string, number>();
    for (const id of ids) map.set(id, 0);
    for (const row of rows) {
      if (row.workerId != null) map.set(row.workerId, (map.get(row.workerId) ?? 0) + 1);
    }
    return map;
  }

  /** Id персон, которые являются сотрудниками хотя бы в одном тенанте (исключаем из подрядчиков). */
  private async getEmployeePersonIds(): Promise<Set<string>> {
    const rows = await this.prisma.employee.findMany({
      select: { personId: true },
      distinct: ['personId'],
    });
    return new Set(rows.map((r) => r.personId));
  }

  private async getCounterparties(
    role: 'seller' | 'contractor',
    search?: string,
    take = DEFAULT_TAKE,
  ): Promise<CounterpartyItem[]> {
    const tenantId = await this.tenantService.getTenantId();

    const personWhere = buildPersonSearchWhere(search);
    const orgWhere = buildOrganizationSearchWhere(search);
    const roleFilter = role === 'seller' ? { seller: true } : { contractor: true };

    const [personsRaw, organizations] = await Promise.all([
      this.prisma.person.findMany({
        where: { ...roleFilter, ...personWhere },
        orderBy: [{ lastname: 'asc' }, { firstname: 'asc' }],
        take: FETCH_LIMIT,
      }),
      this.prisma.organization.findMany({
        where: { ...roleFilter, ...orgWhere },
        orderBy: { name: 'asc' },
        take: FETCH_LIMIT,
      }),
    ]);

    const persons =
      role === 'contractor'
        ? (async () => {
            const employeeIds = await this.getEmployeePersonIds();
            return personsRaw.filter((p) => !employeeIds.has(p.id));
          })()
        : Promise.resolve(personsRaw);

    const personsResolved = await persons;
    const allIds = [...personsResolved.map((p) => p.id), ...organizations.map((o) => o.id)];
    const usageCounts =
      role === 'seller'
        ? await this.getSupplierUsageCounts(allIds, tenantId)
        : await this.getContractorUsageCounts(allIds, tenantId);

    const withLabel = (p: Person) => ({
      ...p,
      _display: personDisplayName(p),
      _count: usageCounts.get(p.id) ?? 0,
    });
    const withLabelOrg = (o: Organization) => ({
      ...o,
      _display: o.name,
      _count: usageCounts.get(o.id) ?? 0,
    });
    const merged = [
      ...personsResolved.map(withLabel),
      ...organizations.map(withLabelOrg),
    ].sort((a, b) => {
      const c = (b._count as number) - (a._count as number);
      return c !== 0 ? c : (a._display as string).localeCompare(b._display as string);
    });

    return merged
      .slice(0, take)
      .map(({ _display, _count, ...rest }) => rest) as CounterpartyItem[];
  }

  /** Поставщики (seller=true), для автокомплита с опциональным поиском. */
  async getSuppliers(search?: string, take = DEFAULT_TAKE): Promise<CounterpartyItem[]> {
    return this.getCounterparties('seller', search, take);
  }

  /** Подрядчики (contractor=true), без сотрудников ни одного тенанта; для автокомплита. */
  async getContractors(search?: string, take = DEFAULT_TAKE): Promise<CounterpartyItem[]> {
    return this.getCounterparties('contractor', search, take);
  }
}
