import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Organization, Prisma } from 'src/generated/prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import type { AuthContext } from 'src/common/user-id.store';
import type { OrganizationModel } from 'src/modules/organization/models/organization.model';
import {
  legalFormByInn,
  validateRequisiteNumbers,
} from 'src/modules/organization/organization-requisites.validation';
import { TenantOrganizationModel } from './models/tenant-organization.model';
import { TenantRequisitesModel } from './models/tenant-requisites.model';
import type { SettingsModel } from './settings.model';

type DbClient = Prisma.TransactionClient | PrismaService;

/** Основная — первой, остальные в порядке привязки. */
const LINK_ORDER: Prisma.TenantOrganizationOrderByWithRelationInput[] = [
  { isDefault: 'desc' },
  { createdAt: 'asc' },
];

export interface TenantOrganizationLink {
  organizationId: string;
  isDefault?: boolean | null;
}

export interface TenantOrganizationsSnapshot {
  organizations: string;
  defaultOrganizationId: string | null;
}

@Injectable()
export class TenantOrganizationService {
  constructor(private readonly prisma: PrismaService) {}

  async list(tenantId: string): Promise<TenantOrganizationModel[]> {
    const rows = await this.prisma.tenantOrganization.findMany({
      where: { tenantId },
      include: { organization: true },
      orderBy: LINK_ORDER,
    });
    return rows.map((row) => ({
      organization: row.organization as OrganizationModel,
      isDefault: row.isDefault,
    }));
  }

  /** Выбранная организация сервиса или основная; `null` — ни одной не привязано. */
  async findForPrint(
    tenantId: string,
    organizationId?: string | null,
  ): Promise<Organization | null> {
    const link = await this.prisma.tenantOrganization.findFirst({
      where: { tenantId, ...(organizationId ? { organizationId } : {}) },
      include: { organization: true },
      orderBy: LINK_ORDER,
    });
    return link?.organization ?? null;
  }

  /**
   * Приводит привязки сервиса к переданному списку. Основная — отмеченная в списке;
   * если не отмечена, остаётся прежняя, иначе самая ранняя из оставшихся или первая новая.
   */
  async replace(
    tx: Prisma.TransactionClient,
    ctx: AuthContext,
    links: TenantOrganizationLink[],
  ): Promise<void> {
    const ids = links.map((link) => link.organizationId);
    if (new Set(ids).size !== ids.length) {
      throw new BadRequestException('Организация указана дважды');
    }
    if (links.filter((link) => link.isDefault).length > 1) {
      throw new BadRequestException(
        'Основной может быть только одна организация',
      );
    }

    const current = await tx.tenantOrganization.findMany({
      where: { tenantId: ctx.tenantId },
      orderBy: { createdAt: 'asc' },
    });
    const currentIds = new Set(current.map((row) => row.organizationId));
    const addedIds = ids.filter((id) => !currentIds.has(id));
    await this.assertAttachable(tx, ctx, addedIds);

    const kept = current.filter((row) => ids.includes(row.organizationId));
    const defaultId =
      links.find((link) => link.isDefault)?.organizationId ??
      kept.find((row) => row.isDefault)?.organizationId ??
      kept[0]?.organizationId ??
      addedIds[0] ??
      null;

    await tx.tenantOrganization.deleteMany({
      where: { tenantId: ctx.tenantId, organizationId: { notIn: ids } },
    });
    if (defaultId) {
      await tx.tenantOrganization.updateMany({
        where: {
          tenantId: ctx.tenantId,
          isDefault: true,
          organizationId: { not: defaultId },
        },
        data: { isDefault: false },
      });
    }
    if (addedIds.length > 0) {
      await tx.tenantOrganization.createMany({
        data: addedIds.map((organizationId) => ({
          tenantId: ctx.tenantId,
          organizationId,
          isDefault: organizationId === defaultId,
          createdBy: ctx.userId,
        })),
      });
    }
    if (defaultId && currentIds.has(defaultId)) {
      await tx.tenantOrganization.update({
        where: {
          tenantId_organizationId: {
            tenantId: ctx.tenantId,
            organizationId: defaultId,
          },
        },
        data: { isDefault: true },
      });
    }
  }

  async snapshot(
    client: DbClient,
    tenantId: string,
  ): Promise<TenantOrganizationsSnapshot> {
    const rows = await client.tenantOrganization.findMany({
      where: { tenantId },
      include: { organization: { select: { name: true } } },
    });
    return {
      organizations: rows
        .map((row) => row.organization.name)
        .sort((a, b) => a.localeCompare(b, 'ru'))
        .join(', '),
      defaultOrganizationId:
        rows.find((row) => row.isDefault)?.organizationId ?? null,
    };
  }

  /** Новые привязки: только организации своей группы с печатными реквизитами. */
  private async assertAttachable(
    tx: Prisma.TransactionClient,
    ctx: AuthContext,
    organizationIds: string[],
  ): Promise<void> {
    if (organizationIds.length === 0) return;
    const organizations = await tx.organization.findMany({
      where: { id: { in: organizationIds }, tenantGroupId: ctx.tenantGroupId },
    });
    if (organizations.length !== organizationIds.length) {
      throw new NotFoundException('Организация не найдена или недоступна');
    }
    for (const organization of organizations) {
      const errors = printabilityErrors(organization);
      if (errors.length > 0) {
        throw new BadRequestException(
          `Заполните карточку организации «${organization.name}»: ${errors.join('; ')}`,
        );
      }
    }
  }
}

/** Чего не хватает организации, чтобы её реквизиты можно было печатать. */
export function printabilityErrors(organization: Organization): string[] {
  const errors: string[] = [];
  if (!organization.requisiteInn) errors.push('укажите ИНН');
  if (!organization.requisiteLegalAddress) {
    errors.push('укажите юридический адрес');
  }
  return [
    ...errors,
    ...validateRequisiteNumbers({
      inn: organization.requisiteInn,
      kpp: organization.requisiteKpp,
      ogrn: organization.requisiteOgrn,
      bik: organization.requisiteBik,
      rs: organization.requisiteRs,
      ks: organization.requisiteKs,
    }),
  ];
}

export function toPrintRequisites(
  organization: Organization,
  settings: SettingsModel,
): TenantRequisitesModel {
  return {
    organizationId: organization.id,
    type: legalFormByInn(organization.requisiteInn) ?? 'OOO',
    name: organization.name,
    address: organization.requisiteLegalAddress,
    inn: organization.requisiteInn,
    kpp: organization.requisiteKpp,
    ogrn: organization.requisiteOgrn,
    bank: organization.requisiteBank,
    rs: organization.requisiteRs,
    ks: organization.requisiteKs,
    bik: organization.requisiteBik,
    head: organization.requisiteHead,
    headType: organization.requisiteHeadPosition,
    actualAddress: settings.brandServiceAddress,
    city: settings.brandContractCity,
    site: settings.brandSite,
    email: settings.brandEmail,
    logoUrl: settings.brandLogoUrl,
    telephones: settings.brandTelephones,
    guarantyUrl: settings.brandGuarantyUrl,
    printFooterImageUrl: settings.brandPrintFooterImageUrl,
    vatRatePercent: organization.vatRatePercent,
  };
}
