import { mockDeep, type DeepMockProxy } from 'jest-mock-extended';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { RecommendationService } from './recommendation.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { ReservationService } from 'src/modules/reservation/reservation.service';
import { SettingsService } from 'src/modules/settings/settings.service';
import { AuditLogService } from 'src/modules/audit-log/audit-log.service';
import { DisplayContextService } from 'src/modules/display-context/display-context.service';
import { createPrismaMock, type PrismaMock } from 'src/common/testing/prisma-mock';
import { makeCtx } from 'src/common/testing/auth-context';

describe('RecommendationService', () => {
  let prisma: PrismaMock;
  let settings: DeepMockProxy<SettingsService>;
  let audit: DeepMockProxy<AuditLogService>;
  let service: RecommendationService;
  const ctx = makeCtx();

  beforeEach(() => {
    prisma = createPrismaMock();
    settings = mockDeep<SettingsService>();
    audit = mockDeep<AuditLogService>();
    settings.getDefaultCurrencyCode.mockResolvedValue('RUB');

    service = new RecommendationService(
      prisma as unknown as PrismaService,
      mockDeep<ReservationService>() as unknown as ReservationService,
      settings as unknown as SettingsService,
      audit as unknown as AuditLogService,
      mockDeep<DisplayContextService>() as unknown as DisplayContextService,
    );
  });

  describe('createRecommendation', () => {
    it('бросает NotFound, если авто не найдено', async () => {
      prisma.car.findFirst.mockResolvedValue(null);
      await expect(
        service.createRecommendation(ctx, {
          carId: 'car-x',
          service: 'Диагностика',
          executorKind: 'PERSON',
          executorId: 'person-1',
        } as any),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('пишет executorKind/executorId, нормализует цену и пишет аудит', async () => {
      prisma.car.findFirst.mockResolvedValue({ id: 'car-1' } as any);
      prisma.carRecommendation.create.mockResolvedValue({
        id: 'rec-1',
        carId: 'car-1',
        service: 'Диагностика',
      } as any);

      await service.createRecommendation(ctx, {
        carId: 'car-1',
        service: 'Диагностика',
        executorKind: 'PERSON',
        executorId: 'person-1',
        priceAmount: null,
      } as any);

      const data = prisma.carRecommendation.create.mock.calls[0][0].data;
      expect(data).toMatchObject({
        executorKind: 'PERSON',
        executorId: 'person-1',
        priceAmount: 0n,
        priceCurrencyCode: 'RUB',
        createdBy: ctx.userId,
      });
      expect(audit.record).toHaveBeenCalledTimes(1);
    });

    it('организация не может быть диагностом', async () => {
      prisma.car.findFirst.mockResolvedValue({ id: 'car-1' } as any);

      await expect(
        service.createRecommendation(ctx, {
          carId: 'car-1',
          service: 'Диагностика',
          executorKind: 'ORGANIZATION',
          executorId: 'org-1',
        } as any),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('подрядчик допустим только для kind=CONTRACTOR', async () => {
      prisma.car.findFirst.mockResolvedValue({ id: 'car-1' } as any);

      await expect(
        service.createRecommendation(ctx, {
          carId: 'car-1',
          service: 'Диагностика',
          kind: 'AUTOSERVICE',
          executorKind: 'PERSON',
          executorId: 'person-1',
          contractorKind: 'ORGANIZATION',
          contractorId: 'org-1',
        } as any),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('подрядная рекомендация пишет contractorKind/contractorId', async () => {
      prisma.car.findFirst.mockResolvedValue({ id: 'car-1' } as any);
      prisma.carRecommendation.create.mockResolvedValue({
        id: 'rec-1',
        carId: 'car-1',
        service: 'Ремонт генератора',
      } as any);

      await service.createRecommendation(ctx, {
        carId: 'car-1',
        service: 'Ремонт генератора',
        kind: 'CONTRACTOR',
        executorKind: 'PERSON',
        executorId: 'person-1',
        contractorKind: 'ORGANIZATION',
        contractorId: 'org-1',
      } as any);

      const data = prisma.carRecommendation.create.mock.calls[0][0].data;
      expect(data).toMatchObject({
        kind: 'CONTRACTOR',
        executorKind: 'PERSON',
        executorId: 'person-1',
        contractorKind: 'ORGANIZATION',
        contractorId: 'org-1',
      });
    });

    it('сторонняя диагностика очищает диагноста при создании', async () => {
      prisma.car.findFirst.mockResolvedValue({ id: 'car-1' } as any);
      prisma.carRecommendation.create.mockResolvedValue({
        id: 'rec-1',
        carId: 'car-1',
        service: 'Диагностика',
      } as any);

      await service.createRecommendation(ctx, {
        carId: 'car-1',
        service: 'Диагностика',
        executorKind: 'PERSON',
        executorId: 'person-1',
        externalDiagnostic: true,
      } as any);

      const data = prisma.carRecommendation.create.mock.calls[0][0].data;
      expect(data).toMatchObject({
        externalDiagnostic: true,
        executorKind: null,
        executorId: null,
      });
    });

    it('audit=false не пишет журнал', async () => {
      prisma.car.findFirst.mockResolvedValue({ id: 'car-1' } as any);
      prisma.carRecommendation.create.mockResolvedValue({
        id: 'rec-1',
        carId: 'car-1',
      } as any);

      await service.createRecommendation(
        ctx,
        {
          carId: 'car-1',
          service: 'S',
          executorKind: 'PERSON',
          executorId: 'p1',
        } as any,
        undefined,
        false,
      );

      expect(audit.record).not.toHaveBeenCalled();
    });
  });

  describe('updateRecommendation', () => {
    it('бросает NotFound при отсутствии рекомендации', async () => {
      prisma.carRecommendation.findFirst.mockResolvedValue(null);
      await expect(
        service.updateRecommendation(ctx, { id: 'nope' } as any),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('передаёт data в update и пишет аудит before/after', async () => {
      prisma.carRecommendation.findFirst.mockResolvedValue({
        id: 'rec-1',
        carId: 'car-1',
        service: 'old',
      } as any);
      prisma.carRecommendation.update.mockResolvedValue({
        id: 'rec-1',
        carId: 'car-1',
        service: 'new',
      } as any);

      await service.updateRecommendation(ctx, {
        id: 'rec-1',
        service: 'new',
        executorKind: 'PERSON',
        executorId: 'person-2',
      } as any);

      const call = prisma.carRecommendation.update.mock.calls[0][0];
      expect(call.where).toEqual({ id: 'rec-1' });
      expect(call.data).toMatchObject({
        service: 'new',
        executorKind: 'PERSON',
        executorId: 'person-2',
      });
      expect(audit.record).toHaveBeenCalledTimes(1);
    });

    it('перевод в AUTOSERVICE очищает подрядчика', async () => {
      prisma.carRecommendation.findFirst.mockResolvedValue({
        id: 'rec-1',
        carId: 'car-1',
        service: 'S',
        kind: 'CONTRACTOR',
        executorKind: 'PERSON',
        executorId: 'person-1',
        contractorKind: 'ORGANIZATION',
        contractorId: 'org-1',
      } as any);
      prisma.carRecommendation.update.mockResolvedValue({
        id: 'rec-1',
        carId: 'car-1',
        service: 'S',
      } as any);

      await service.updateRecommendation(ctx, {
        id: 'rec-1',
        kind: 'AUTOSERVICE',
      } as any);

      const call = prisma.carRecommendation.update.mock.calls[0][0];
      expect(call.data).toMatchObject({
        kind: 'AUTOSERVICE',
        contractorKind: null,
        contractorId: null,
      });
    });

    it('включение сторонней диагностики очищает диагноста', async () => {
      prisma.carRecommendation.findFirst.mockResolvedValue({
        id: 'rec-1',
        carId: 'car-1',
        service: 'S',
        kind: 'AUTOSERVICE',
        executorKind: 'PERSON',
        executorId: 'person-1',
        externalDiagnostic: false,
      } as any);
      prisma.carRecommendation.update.mockResolvedValue({
        id: 'rec-1',
        carId: 'car-1',
        service: 'S',
      } as any);

      await service.updateRecommendation(ctx, {
        id: 'rec-1',
        externalDiagnostic: true,
      } as any);

      const call = prisma.carRecommendation.update.mock.calls[0][0];
      expect(call.data).toMatchObject({
        externalDiagnostic: true,
        executorKind: null,
        executorId: null,
      });
    });

    it('назначение диагноста снимает флаг сторонней диагностики', async () => {
      prisma.carRecommendation.findFirst.mockResolvedValue({
        id: 'rec-1',
        carId: 'car-1',
        service: 'S',
        kind: 'AUTOSERVICE',
        executorKind: null,
        executorId: null,
        externalDiagnostic: true,
      } as any);
      prisma.carRecommendation.update.mockResolvedValue({
        id: 'rec-1',
        carId: 'car-1',
        service: 'S',
      } as any);

      await service.updateRecommendation(ctx, {
        id: 'rec-1',
        executorKind: 'PERSON',
        executorId: 'person-2',
      } as any);

      const call = prisma.carRecommendation.update.mock.calls[0][0];
      expect(call.data).toMatchObject({
        executorKind: 'PERSON',
        executorId: 'person-2',
        externalDiagnostic: false,
      });
    });
  });

  describe('deleteRecommendation', () => {
    it('бросает NotFound при отсутствии', async () => {
      prisma.carRecommendation.findFirst.mockResolvedValue(null);
      await expect(
        service.deleteRecommendation(ctx, 'nope'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('getContractorFlagsForNames', () => {
    beforeEach(() => {
      prisma.organization.findMany.mockResolvedValue([
        { id: 'org-polluted' },
      ] as any);
    });

    it('возвращает флаги для совпадающих названий (case-insensitive)', async () => {
      prisma.carRecommendation.findMany.mockResolvedValue([
        { service: 'Ремонт рулевой рейки' },
        { service: 'ремонт генератора' },
      ] as any);

      const flags = await service.getContractorFlagsForNames(ctx, [
        'Ремонт рулевой рейки',
        'Ремонт генератора',
        'Замена масла',
      ]);

      expect(flags.get('Ремонт рулевой рейки')).toBe(true);
      expect(flags.get('Ремонт генератора')).toBe(true);
      expect(flags.get('Замена масла')).toBe(false);

      const where = (prisma.carRecommendation.findMany.mock.calls[0][0] as any)
        .where;
      expect(where.AND[0]).toMatchObject({
        kind: 'CONTRACTOR',
        tenantGroupId: ctx.tenantGroupId,
      });
      expect(where.AND[0].OR).toEqual(
        expect.arrayContaining([
          { contractorId: null },
          { contractorId: { notIn: ['org-polluted'] } },
        ]),
      );
    });

    it('пустой ввод — все false', async () => {
      const flags = await service.getContractorFlagsForNames(ctx, ['', '  ']);
      expect(flags.get('')).toBe(false);
      expect(prisma.carRecommendation.findMany).not.toHaveBeenCalled();
    });
  });
});
