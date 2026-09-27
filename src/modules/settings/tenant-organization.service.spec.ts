/* eslint-disable @typescript-eslint/unbound-method -- jest-моки проверяются по ссылке на метод */
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma, type Organization } from 'src/generated/prisma/client';
import {
  createPrismaMock,
  type PrismaMock,
} from 'src/common/testing/prisma-mock';
import { makeCtx } from 'src/common/testing/auth-context';
import type { SettingsModel } from './settings.model';
import {
  TenantOrganizationService,
  toPrintRequisites,
} from './tenant-organization.service';

function organization(over: Partial<Organization> = {}): Organization {
  return {
    id: 'org-1',
    name: 'ИП Сидоров Кирилл Михайлович',
    address: null,
    telephone: null,
    officePhone: null,
    email: null,
    contractor: false,
    seller: false,
    tenantGroupId: 'group-1',
    requisiteBank: 'ООО "Банк Точка"',
    requisiteLegalAddress: 'г. Москва',
    requisiteOgrn: '324774600492011',
    requisiteInn: '166016686002',
    requisiteKpp: null,
    requisiteRs: '40802810620000372884',
    requisiteKs: '30101810745374525104',
    requisiteBik: '044525104',
    requisiteHead: 'Сидоров К.М.',
    requisiteHeadPosition: 'Индивидуальный предприниматель',
    createdAt: null,
    createdBy: null,
    balance: new Prisma.Decimal(0),
    ...over,
  };
}

function link(organizationId: string, isDefault = false) {
  return {
    tenantId: 'tenant-1',
    organizationId,
    isDefault,
    createdAt: new Date(),
    createdBy: null,
  };
}

describe('TenantOrganizationService', () => {
  let prisma: PrismaMock;
  let service: TenantOrganizationService;
  const ctx = makeCtx();

  beforeEach(() => {
    prisma = createPrismaMock();
    service = new TenantOrganizationService(prisma);
    prisma.tenantOrganization.findMany.mockResolvedValue([]);
  });

  it('без привязанных организаций печатать не от кого', async () => {
    prisma.tenantOrganization.findFirst.mockResolvedValue(null);

    await expect(service.findForPrint(ctx.tenantId)).resolves.toBeNull();
    expect(prisma.tenantOrganization.findFirst.mock.calls[0][0]?.where).toEqual(
      { tenantId: ctx.tenantId },
    );
  });

  it('печать собирает юр. лицо и торговую марку', () => {
    const print = toPrintRequisites(organization(), {
      brandLogoUrl: '/img/logo.png',
      brandContractCity: 'г. Москва',
      brandTelephones: ['+7 (495) 984-81-82'],
    } as SettingsModel);

    expect(print).toMatchObject({
      organizationId: 'org-1',
      type: 'IP',
      inn: '166016686002',
      headType: 'Индивидуальный предприниматель',
      logoUrl: '/img/logo.png',
      city: 'г. Москва',
      telephones: ['+7 (495) 984-81-82'],
    });
  });

  it('чужую организацию привязать нельзя', async () => {
    prisma.organization.findMany.mockResolvedValue([]);

    await expect(
      service.replace(prisma, ctx, [{ organizationId: 'org-b' }]),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.organization.findMany.mock.calls[0][0]?.where).toEqual({
      id: { in: ['org-b'] },
      tenantGroupId: ctx.tenantGroupId,
    });
    expect(prisma.tenantOrganization.createMany).not.toHaveBeenCalled();
  });

  it('организацию с ошибкой в реквизитах привязать нельзя', async () => {
    prisma.organization.findMany.mockResolvedValue([
      organization({ requisiteInn: '166016686003' }),
    ]);

    await expect(
      service.replace(prisma, ctx, [{ organizationId: 'org-1' }]),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.tenantOrganization.createMany).not.toHaveBeenCalled();
  });

  it('одна организация дважды или две основные — ошибка', async () => {
    await expect(
      service.replace(prisma, ctx, [
        { organizationId: 'org-1' },
        { organizationId: 'org-1' },
      ]),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.replace(prisma, ctx, [
        { organizationId: 'org-1', isDefault: true },
        { organizationId: 'org-2', isDefault: true },
      ]),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('первая привязанная организация становится основной', async () => {
    prisma.organization.findMany.mockResolvedValue([organization()]);

    await service.replace(prisma, ctx, [{ organizationId: 'org-1' }]);

    const [args] = prisma.tenantOrganization.createMany.mock.calls[0];
    expect(args?.data).toEqual([
      {
        tenantId: ctx.tenantId,
        organizationId: 'org-1',
        isDefault: true,
        createdBy: ctx.userId,
      },
    ]);
  });

  it('без основной в списке основной становится самая ранняя из оставшихся', async () => {
    prisma.tenantOrganization.findMany.mockResolvedValue([
      link('org-1', true),
      link('org-2'),
      link('org-3'),
    ]);

    await service.replace(prisma, ctx, [
      { organizationId: 'org-3' },
      { organizationId: 'org-2' },
    ]);

    expect(prisma.tenantOrganization.deleteMany).toHaveBeenCalledWith({
      where: {
        tenantId: ctx.tenantId,
        organizationId: { notIn: ['org-3', 'org-2'] },
      },
    });
    expect(prisma.tenantOrganization.update).toHaveBeenCalledWith({
      where: {
        tenantId_organizationId: {
          tenantId: ctx.tenantId,
          organizationId: 'org-2',
        },
      },
      data: { isDefault: true },
    });
    expect(prisma.organization.findMany).not.toHaveBeenCalled();
  });

  it('пустой список отвязывает все организации', async () => {
    prisma.tenantOrganization.findMany.mockResolvedValue([link('org-1', true)]);

    await service.replace(prisma, ctx, []);

    expect(prisma.tenantOrganization.deleteMany).toHaveBeenCalledWith({
      where: { tenantId: ctx.tenantId, organizationId: { notIn: [] } },
    });
    expect(prisma.tenantOrganization.update).not.toHaveBeenCalled();
  });
});
