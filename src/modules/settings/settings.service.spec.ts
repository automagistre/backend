/* eslint-disable @typescript-eslint/unbound-method -- jest-моки проверяются по ссылке на метод */
import { mockDeep, type DeepMockProxy } from 'jest-mock-extended';
import { BadRequestException } from '@nestjs/common';
import { AuditLogService } from 'src/modules/audit-log/audit-log.service';
import {
  createPrismaMock,
  type PrismaMock,
} from 'src/common/testing/prisma-mock';
import { makeCtx } from 'src/common/testing/auth-context';
import { SettingsService } from './settings.service';
import { TenantOrganizationService } from './tenant-organization.service';

describe('SettingsService', () => {
  let prisma: PrismaMock;
  let auditLog: DeepMockProxy<AuditLogService>;
  let tenantOrganizations: DeepMockProxy<TenantOrganizationService>;
  let service: SettingsService;
  const ctx = makeCtx();

  beforeEach(() => {
    prisma = createPrismaMock();
    auditLog = mockDeep<AuditLogService>();
    tenantOrganizations = mockDeep<TenantOrganizationService>();
    service = new SettingsService(prisma, auditLog, tenantOrganizations);
    prisma.setting.findMany.mockResolvedValue([]);
    prisma.tenant.findFirst.mockResolvedValue({ name: 'Старое' } as never);
    tenantOrganizations.snapshot.mockResolvedValue({
      organizations: '',
      defaultOrganizationId: null,
    });
  });

  it('без сохранённых значений торговая марка пустая', async () => {
    const settings = await service.getSettings(ctx.tenantId);

    expect(settings.brandLogoUrl).toBeNull();
    expect(settings.brandTelephones).toEqual([]);
    expect(settings.workDayHours).toBe(11);
  });

  it('очищенное поле торговой марки удаляет настройку', async () => {
    await service.updateSettings(ctx, {
      brandSite: '  ',
      brandLogoUrl: ' /img/logo.png ',
    });

    expect(prisma.setting.deleteMany).toHaveBeenCalledWith({
      where: { tenantId: ctx.tenantId, key: 'brandSite' },
    });
    const upsert = prisma.setting.upsert.mock.calls[0][0];
    expect(upsert.create.key).toBe('brandLogoUrl');
    expect(upsert.create.value).toBe('/img/logo.png');
  });

  it('неверный email торговой марки отклоняется', async () => {
    await expect(
      service.updateSettings(ctx, { brandEmail: 'info@' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.setting.upsert).not.toHaveBeenCalled();
  });

  it('переименование меняет только name своего тенанта', async () => {
    await service.updateSettings(ctx, { tenantName: '  Новое  ' });

    const updateArgs = prisma.tenant.updateMany.mock.calls[0][0];
    expect(updateArgs.where).toEqual({ id: ctx.tenantId });
    expect(updateArgs.data.name).toBe('Новое');
    expect(Object.keys(updateArgs.data)).toEqual(['name', 'updated_at']);
    expect(tenantOrganizations.replace).not.toHaveBeenCalled();
  });

  it('пустое название отклоняется', async () => {
    await expect(
      service.updateSettings(ctx, { tenantName: '   ' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.tenant.updateMany).not.toHaveBeenCalled();
  });

  it('название и организации пишутся одной транзакцией и одним событием аудита', async () => {
    const links = [{ organizationId: 'org-1', isDefault: true }];

    await service.updateSettings(ctx, {
      tenantName: 'Новое',
      tenantOrganizations: links,
      supplyExpiryDays: 5,
    });

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tenantOrganizations.replace).toHaveBeenCalledWith(
      prisma,
      ctx,
      links,
    );
    expect(prisma.setting.upsert).toHaveBeenCalledTimes(1);
    expect(auditLog.record).toHaveBeenCalledTimes(1);
  });

  it('пустой патч отклоняется', async () => {
    await expect(service.updateSettings(ctx, {})).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
