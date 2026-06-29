import { mockDeep, type DeepMockProxy } from 'jest-mock-extended';
import { PartPriceService } from './part-price.service';
import { PartDiscountService } from './part-discount.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { SettingsService } from 'src/modules/settings/settings.service';
import { createPrismaMock, type PrismaMock } from 'src/common/testing/prisma-mock';

describe('PartPriceService / PartDiscountService', () => {
  let prisma: PrismaMock;
  let settings: DeepMockProxy<SettingsService>;

  beforeEach(() => {
    prisma = createPrismaMock();
    settings = mockDeep<SettingsService>();
    settings.getDefaultCurrencyCode.mockResolvedValue('RUB');
  });

  describe('PartPriceService.create', () => {
    it('нормализует сумму (null→0n) и ставит валюту по умолчанию', async () => {
      const service = new PartPriceService(
        prisma as unknown as PrismaService,
        settings as unknown as SettingsService,
      );
      prisma.partPrice.create.mockResolvedValue({ id: 'pp1' } as any);

      await service.create({
        partId: 'p1',
        since: new Date(),
        priceAmount: null,
        tenantId: 't1',
        createdBy: 'u1',
      } as any);

      expect(prisma.partPrice.create.mock.calls[0][0].data).toMatchObject({
        priceAmount: 0n,
        priceCurrencyCode: 'RUB',
      });
    });
  });

  describe('PartDiscountService.create', () => {
    it('нормализует скидку и ставит валюту по умолчанию', async () => {
      const service = new PartDiscountService(
        prisma as unknown as PrismaService,
        settings as unknown as SettingsService,
      );
      prisma.partDiscount.create.mockResolvedValue({ id: 'pd1' } as any);

      await service.create({
        partId: 'p1',
        since: new Date(),
        discountAmount: 25000n,
        tenantId: 't1',
        createdBy: 'u1',
      } as any);

      expect(prisma.partDiscount.create.mock.calls[0][0].data).toMatchObject({
        discountAmount: 25000n,
        discountCurrencyCode: 'RUB',
      });
    });
  });
});
