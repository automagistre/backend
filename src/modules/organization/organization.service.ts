import {
  BadRequestException,
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
import { AuditLogService } from 'src/modules/audit-log/audit-log.service';
import { AuditEntityType } from 'src/modules/audit-log/enums/audit.enums';
import {
  normalizeRequisiteNumber,
  validateRequisiteNumbers,
} from './organization-requisites.validation';

export type OrganizationLookupRow = {
  id: string;
  name: string;
};

const DEFAULT_TAKE = 25;

function text(value: string | null | undefined): string | null {
  return value?.trim() || null;
}

/** Нормализует реквизиты и проверяет номера по контрольным суммам. */
function toRequisiteData(requisite: RequisiteInput) {
  const data = {
    requisiteBank: text(requisite.bank),
    requisiteLegalAddress: text(requisite.legalAddress),
    requisiteOgrn: normalizeRequisiteNumber(requisite.ogrn),
    requisiteInn: normalizeRequisiteNumber(requisite.inn),
    requisiteKpp: normalizeRequisiteNumber(requisite.kpp),
    requisiteRs: normalizeRequisiteNumber(requisite.rs),
    requisiteKs: normalizeRequisiteNumber(requisite.ks),
    requisiteBik: normalizeRequisiteNumber(requisite.bik),
    requisiteHead: text(requisite.head),
    requisiteHeadPosition: text(requisite.headPosition),
  };
  const errors = validateRequisiteNumbers({
    inn: data.requisiteInn,
    kpp: data.requisiteKpp,
    ogrn: data.requisiteOgrn,
    bik: data.requisiteBik,
    rs: data.requisiteRs,
    ks: data.requisiteKs,
  });
  if (errors.length > 0) {
    throw new BadRequestException(errors.join('; '));
  }
  return data;
}
const DEFAULT_SKIP = 0;

@Injectable()
export class OrganizationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  private async auditOrganization(
    ctx: AuthContext,
    id: string,
    before: Record<string, any> | null,
    after: Record<string, any> | null,
  ): Promise<void> {
    const row = after ?? before;
    await this.auditLog.record(this.prisma, ctx, {
      rootEntityType: AuditEntityType.ORGANIZATION,
      rootEntityId: id,
      entityType: AuditEntityType.ORGANIZATION,
      entityId: id,
      before,
      after,
      entityDisplayName: row?.name ?? null,
    });
  }

  async create(ctx: AuthContext, data: CreateOrganizationInput) {
    const { requisite, ...mainData } = data;

    const created = await this.prisma.organization.create({
      data: {
        ...mainData,
        tenantGroupId: ctx.tenantGroupId,
        createdBy: ctx.userId,
        ...(requisite && toRequisiteData(requisite)),
      },
    });

    await this.auditOrganization(ctx, created.id, null, created);

    return created;
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

    const requisiteData =
      requisite !== undefined ? toRequisiteData(requisite ?? {}) : null;
    if (
      requisiteData &&
      (!requisiteData.requisiteInn || !requisiteData.requisiteLegalAddress)
    ) {
      const linked = await this.prisma.tenantOrganization.count({
        where: { organizationId: id },
      });
      if (linked > 0) {
        throw new BadRequestException(
          'Организация печатается в документах сервиса: ИНН и юридический адрес обязательны',
        );
      }
    }

    const updated = await this.prisma.organization.update({
      where: { id },
      data: { ...mainData, ...requisiteData },
    });

    await this.auditOrganization(ctx, id, existing, updated);

    return updated;
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

    const [orderItemPartCount, orderCount, incomeCount, tenantLinkCount] =
      await Promise.all([
        this.prisma.orderItemPart.count({ where: { supplierId: id } }),
        this.prisma.order.count({ where: { customerId: id } }),
        this.prisma.income.count({ where: { supplierId: id } }),
        this.prisma.tenantOrganization.count({ where: { organizationId: id } }),
      ]);

    if (tenantLinkCount > 0) {
      throw new ConflictException(
        'Нельзя удалить: организация указана в реквизитах сервиса. Сначала отвяжите её в настройках',
      );
    }

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

    const deleted = await this.prisma.organization.delete({
      where: { id },
    });

    await this.auditOrganization(ctx, id, existing, null);

    return deleted;
  }
}
