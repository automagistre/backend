import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  CreateOrganizationInput,
  RequisiteInput,
  UpdateOrganizationInput,
} from './inputs/organization.input';
import type { AuthContext } from 'src/common/user-id.store';

export type OrganizationLookupRow = {
  id: string;
  name: string;
};

const DEFAULT_TAKE = 25;
const DEFAULT_SKIP = 0;

@Injectable()
export class OrganizationService {
  constructor(private readonly prisma: PrismaService) {}

  async create(ctx: AuthContext, data: CreateOrganizationInput) {
    const { requisite, ...mainData } = data;

    return this.prisma.organization.create({
      data: {
        ...mainData,
        tenantGroupId: ctx.tenantGroupId,
        createdBy: ctx.userId,
        ...(requisite && {
          requisiteBank: requisite.bank,
          requisiteLegalAddress: requisite.legalAddress,
          requisiteOgrn: requisite.ogrn,
          requisiteInn: requisite.inn,
          requisiteKpp: requisite.kpp,
          requisiteRs: requisite.rs,
          requisiteKs: requisite.ks,
          requisiteBik: requisite.bik,
        }),
      },
    });
  }

  async update(
    ctx: AuthContext,
    {
      id,
      requisite,
      ...mainData
    }: UpdateOrganizationInput & { requisite?: RequisiteInput | null },
  ) {
    const existing = await this.prisma.organization.findFirst({
      where: { id, tenantGroupId: ctx.tenantGroupId },
    });
    if (!existing) {
      throw new NotFoundException('Организация не найдена или недоступна');
    }

    return this.prisma.organization.update({
      where: { id },
      data: {
        ...mainData,
        ...(requisite !== undefined && {
          requisiteBank: requisite?.bank ?? null,
          requisiteLegalAddress: requisite?.legalAddress ?? null,
          requisiteOgrn: requisite?.ogrn ?? null,
          requisiteInn: requisite?.inn ?? null,
          requisiteKpp: requisite?.kpp ?? null,
          requisiteRs: requisite?.rs ?? null,
          requisiteKs: requisite?.ks ?? null,
          requisiteBik: requisite?.bik ?? null,
        }),
      },
    });
  }

  async findMany(
    ctx: AuthContext,
    {
      take = DEFAULT_TAKE,
      skip = DEFAULT_SKIP,
      search,
    }: {
      take?: number;
      skip?: number;
      search?: string;
    },
  ) {
    const baseWhere = { tenantGroupId: ctx.tenantGroupId };

    const where = search
      ? {
          ...baseWhere,
          OR: [
            { name: { contains: search, mode: 'insensitive' as const } },
            { address: { contains: search, mode: 'insensitive' as const } },
            { email: { contains: search, mode: 'insensitive' as const } },
            { telephone: { contains: search, mode: 'insensitive' as const } },
            {
              requisiteInn: { contains: search, mode: 'insensitive' as const },
            },
            {
              requisiteOgrn: { contains: search, mode: 'insensitive' as const },
            },
          ],
        }
      : baseWhere;

    const [items, total] = await Promise.all([
      this.prisma.organization.findMany({
        where,
        take: +take,
        skip: +skip,
        orderBy: { id: 'desc' },
      }),
      this.prisma.organization.count({ where }),
    ]);

    return { items, total };
  }

  async findOne(ctx: AuthContext, id: string) {
    return this.prisma.organization.findFirst({
      where: { id, tenantGroupId: ctx.tenantGroupId },
    });
  }

  /** ID организаций по поисковому запросу (для поиска заказов по заказчику-юрлицу). */
  async findIdsBySearch(ctx: AuthContext, search: string): Promise<string[]> {
    const term = search.trim();
    if (!term) return [];
    const orgs = await this.prisma.organization.findMany({
      where: {
        tenantGroupId: ctx.tenantGroupId,
        OR: [
          { name: { contains: term, mode: 'insensitive' } },
          { address: { contains: term, mode: 'insensitive' } },
          { email: { contains: term, mode: 'insensitive' } },
          { telephone: { contains: term, mode: 'insensitive' } },
          { officePhone: { contains: term, mode: 'insensitive' } },
          { requisiteInn: { contains: term, mode: 'insensitive' } },
          { requisiteOgrn: { contains: term, mode: 'insensitive' } },
        ],
      },
      select: { id: true },
      take: 500,
    });
    return orgs.map((o) => o.id);
  }

  async getNamesByIds(ids: string[]): Promise<Map<string, string>> {
    if (ids.length === 0) return new Map();

    const organizations = await this.prisma.organization.findMany({
      where: { id: { in: ids } },
      select: { id: true, name: true },
    });

    return new Map(organizations.map((o) => [o.id, o.name ?? 'Без названия']));
  }

  async findByPhonesInTenantGroup(
    tenantGroupId: string,
    phones: string[],
    take = 2,
  ): Promise<OrganizationLookupRow[]> {
    if (phones.length === 0) {
      return [];
    }
    const rows = await this.prisma.organization.findMany({
      where: {
        tenantGroupId,
        OR: [{ telephone: { in: phones } }, { officePhone: { in: phones } }],
      },
      select: { id: true, name: true },
      take,
    });
    return rows;
  }

  // TODO: OrderItemPart.supplierId имеет onDelete: SetNull, Order.customerId и Income.supplierId — полиморфные связи.
  // Ручные проверки необходимы для бизнес-логики, constraint БД не блокирует удаление.
  async remove(ctx: AuthContext, id: string) {
    const existing = await this.prisma.organization.findFirst({
      where: { id, tenantGroupId: ctx.tenantGroupId },
    });
    if (!existing) {
      throw new NotFoundException('Организация не найдена или недоступна');
    }

    const [orderItemPartCount, orderCount, incomeCount] = await Promise.all([
      this.prisma.orderItemPart.count({ where: { supplierId: id } }),
      this.prisma.order.count({ where: { customerId: id } }),
      this.prisma.income.count({ where: { supplierId: id } }),
    ]);

    if (orderCount > 0) {
      throw new ConflictException(
        `Нельзя удалить: организация является заказчиком в ${orderCount} заказах`,
      );
    }

    if (orderItemPartCount > 0) {
      throw new ConflictException(
        `Нельзя удалить: организация является поставщиком в ${orderItemPartCount} позициях заказов`,
      );
    }

    if (incomeCount > 0) {
      throw new ConflictException(
        `Нельзя удалить: организация является поставщиком в ${incomeCount} приходах`,
      );
    }

    return this.prisma.organization.delete({
      where: { id },
    });
  }
}
