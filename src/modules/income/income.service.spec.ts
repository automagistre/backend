import { mockDeep, type DeepMockProxy } from 'jest-mock-extended';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { IncomeService } from './income.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { SettingsService } from 'src/modules/settings/settings.service';
import { PartMotionService } from 'src/modules/warehouse/part-motion.service';
import { PartSupplyService } from 'src/modules/warehouse/part-supply.service';
import { ReservationService } from 'src/modules/reservation/reservation.service';
import { OrderService } from 'src/modules/order/order.service';
import { WalletTransactionService } from 'src/modules/wallet/wallet-transaction.service';
import { createPrismaMock, type PrismaMock } from 'src/common/testing/prisma-mock';
import { makeCtx } from 'src/common/testing/auth-context';

describe('IncomeService', () => {
  let prisma: PrismaMock;
  let settings: DeepMockProxy<SettingsService>;
  let walletTx: DeepMockProxy<WalletTransactionService>;
  let service: IncomeService;
  const ctx = makeCtx();

  const partRow = { id: 'p1', manufacturer: null };

  beforeEach(() => {
    prisma = createPrismaMock();
    settings = mockDeep<SettingsService>();
    walletTx = mockDeep<WalletTransactionService>();
    settings.getDefaultCurrencyCode.mockResolvedValue('RUB');
    service = new IncomeService(
      prisma as unknown as PrismaService,
      settings as unknown as SettingsService,
      mockDeep<PartMotionService>() as unknown as PartMotionService,
      mockDeep<PartSupplyService>() as unknown as PartSupplyService,
      mockDeep<ReservationService>() as unknown as ReservationService,
      mockDeep<OrderService>() as unknown as OrderService,
      walletTx as unknown as WalletTransactionService,
    );
  });

  it('findById бросает NotFound', async () => {
    jest.mocked(prisma.income.findFirst).mockResolvedValue(null as any);
    await expect(service.findById(ctx, 'x')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('update запрещён для оприходованного прихода', async () => {
    jest.mocked(prisma.income.findFirst).mockResolvedValue({
      id: 'i1',
      incomeAccrue: { id: 'a1' },
    } as any);
    await expect(
      service.update(ctx, { id: 'i1', document: 'doc' } as any),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  describe('createIncomePart', () => {
    it('бросает BadRequest при количестве <= 0', async () => {
      jest.mocked(prisma.income.findFirst).mockResolvedValue({
        id: 'i1',
        incomeAccrue: null,
      } as any);
      await expect(
        service.createIncomePart(ctx, {
          incomeId: 'i1',
          partId: 'p1',
          quantity: 0,
          price: { amountMinor: 100n, currencyCode: 'RUB' },
        } as any),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('создаёт позицию с нормализацией валюты', async () => {
      jest.mocked(prisma.income.findFirst).mockResolvedValue({
        id: 'i1',
        incomeAccrue: null,
      } as any);
      jest.mocked(prisma.incomePart.create).mockResolvedValue({
        id: 'ip1',
        incomeId: 'i1',
        partId: 'p1',
        quantity: 100,
        priceAmount: 100n,
        priceCurrencyCode: 'RUB',
        part: partRow,
      } as any);

      const res = await service.createIncomePart(ctx, {
        incomeId: 'i1',
        partId: 'p1',
        quantity: 100,
        price: { amountMinor: 100n, currencyCode: null },
      } as any);

      const arg = jest.mocked(prisma.incomePart.create).mock.calls[0][0].data as any;
      expect(arg.priceCurrencyCode).toBe('RUB');
      expect(res.price?.amountMinor).toBe(100n);
    });
  });

  describe('accrue валидация', () => {
    const incomeReady = {
      id: 'i1',
      supplierId: 's1',
      incomeAccrue: null,
      incomeParts: [
        { id: 'ip1', partId: 'p1', quantity: 100, priceAmount: 10000n, priceCurrencyCode: 'RUB', part: partRow },
      ],
    };

    it('NotFound, если прихода нет', async () => {
      jest.mocked(prisma.income.findFirst).mockResolvedValue(null as any);
      await expect(service.accrue(ctx, 'i1')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('BadRequest, если уже оприходован', async () => {
      jest.mocked(prisma.income.findFirst).mockResolvedValue({
        ...incomeReady,
        incomeAccrue: { id: 'a1' },
      } as any);
      await expect(service.accrue(ctx, 'i1')).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('BadRequest, если нет позиций', async () => {
      jest.mocked(prisma.income.findFirst).mockResolvedValue({
        ...incomeReady,
        incomeParts: [],
      } as any);
      await expect(service.accrue(ctx, 'i1')).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('BadRequest, если сумма оплаты больше суммы прихода', async () => {
      jest.mocked(prisma.income.findFirst).mockResolvedValue(incomeReady as any);
      await expect(
        service.accrue(ctx, 'i1', {
          walletId: 'w1',
          amount: { amountMinor: 999999n, currencyCode: 'RUB' },
        } as any),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('NotFound, если счёт оплаты не найден', async () => {
      jest.mocked(prisma.income.findFirst).mockResolvedValue(incomeReady as any);
      walletTx.findOne.mockResolvedValue(null as any);
      await expect(
        service.accrue(ctx, 'i1', {
          walletId: 'w1',
          amount: { amountMinor: 5000n, currencyCode: 'RUB' },
        } as any),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('BadRequest, если счёт недоступен для приходов', async () => {
      jest.mocked(prisma.income.findFirst).mockResolvedValue(incomeReady as any);
      walletTx.findOne.mockResolvedValue({ useInIncome: false } as any);
      await expect(
        service.accrue(ctx, 'i1', {
          walletId: 'w1',
          amount: { amountMinor: 5000n, currencyCode: 'RUB' },
        } as any),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });
});
