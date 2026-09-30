import { mockDeep, type DeepMockProxy } from 'jest-mock-extended';
import { BadRequestException } from '@nestjs/common';
import { CustomerTransactionService } from './customer-transaction.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { WalletService } from 'src/modules/wallet/wallet.service';
import { WalletTransactionService } from 'src/modules/wallet/wallet-transaction.service';
import { DisplayContextService } from 'src/modules/display-context/display-context.service';
import { SettingsService } from 'src/modules/settings/settings.service';
import { CustomerTransactionSource } from './enums/customer-transaction-source.enum';
import { createPrismaMock, type PrismaMock } from 'src/common/testing/prisma-mock';
import { makeCtx } from 'src/common/testing/auth-context';

describe('CustomerTransactionService', () => {
  let prisma: PrismaMock;
  let wallet: DeepMockProxy<WalletService>;
  let walletTx: DeepMockProxy<WalletTransactionService>;
  let display: DeepMockProxy<DisplayContextService>;
  let settings: DeepMockProxy<SettingsService>;
  let service: CustomerTransactionService;
  const ctx = makeCtx();

  beforeEach(() => {
    prisma = createPrismaMock();
    wallet = mockDeep<WalletService>();
    walletTx = mockDeep<WalletTransactionService>();
    display = mockDeep<DisplayContextService>();
    settings = mockDeep<SettingsService>();
    settings.getDefaultCurrencyCode.mockResolvedValue('RUB');

    service = new CustomerTransactionService(
      prisma as unknown as PrismaService,
      wallet as unknown as WalletService,
      walletTx as unknown as WalletTransactionService,
      display as unknown as DisplayContextService,
      settings as unknown as SettingsService,
    );
  });

  describe('createWithinTransaction', () => {
    it('пишет операнд/источник/сумму; пустая сумма → 0n с валютой по умолчанию', async () => {
      jest.mocked(prisma.customerTransaction.create).mockResolvedValue({ id: 'ct1' } as any);

      await service.createWithinTransaction(
        prisma as any,
        {
          operandId: 'person-1',
          source: CustomerTransactionSource.OrderSalary,
          sourceId: 'order-1',
        } as any,
        ctx.tenantId,
        ctx.userId,
      );

      expect(jest.mocked(prisma.customerTransaction.create).mock.calls[0][0].data).toMatchObject({
        operandId: 'person-1',
        source: CustomerTransactionSource.OrderSalary,
        sourceId: 'order-1',
        amountAmount: 0n,
        amountCurrencyCode: 'RUB',
      });
    });
  });

  describe('getBalance', () => {
    it('возвращает сумму проводок (0n при отсутствии)', async () => {
      jest.mocked(prisma.customerTransaction.aggregate).mockResolvedValue({
        _sum: { amountAmount: 1500n },
      } as any);
      expect(await service.getBalance(ctx, 'person-1')).toBe(1500n);

      jest.mocked(prisma.customerTransaction.aggregate).mockResolvedValue({
        _sum: { amountAmount: null },
      } as any);
      expect(await service.getBalance(ctx, 'person-1')).toBe(0n);
    });
  });

  describe('getMonthlyIncome', () => {
    it('заполняет месяцы нулями и складывает net', async () => {
      settings.getTimezone.mockResolvedValue('Europe/Moscow');
      jest.mocked(prisma.customerTransaction.findMany).mockResolvedValue([
        {
          createdAt: new Date('2026-07-15T12:00:00+03:00'),
          source: CustomerTransactionSource.OrderSalary,
          amountAmount: 10000n,
        },
        {
          createdAt: new Date('2026-07-20T12:00:00+03:00'),
          source: CustomerTransactionSource.Penalty,
          amountAmount: -1500n,
        },
      ] as any);

      const result = await service.getMonthlyIncome(
        ctx,
        'person-1',
        new Date('2026-07-01T00:00:00+03:00'),
        new Date('2026-08-15T00:00:00+03:00'),
      );

      expect(result).toHaveLength(2);
      expect(result[0].salaryAmount.amountMinor).toBe(10000n);
      expect(result[0].penaltyAmount.amountMinor).toBe(-1500n);
      expect(result[0].netAmount.amountMinor).toBe(8500n);
      expect(result[1].salaryAmount.amountMinor).toBe(0n);
      expect(result[1].netAmount.amountMinor).toBe(0n);
    });

    it('премия и корректировка сдельной — начисления, прочие ручные проводки не берутся', async () => {
      settings.getTimezone.mockResolvedValue('Europe/Moscow');
      jest.mocked(prisma.customerTransaction.findMany).mockResolvedValue([
        {
          createdAt: new Date('2026-07-15T12:00:00+03:00'),
          source: CustomerTransactionSource.Bonus,
          amountAmount: 5000n,
        },
        {
          createdAt: new Date('2026-07-16T12:00:00+03:00'),
          source: CustomerTransactionSource.PieceworkCorrection,
          amountAmount: -2000n,
        },
      ] as any);

      const [july] = await service.getMonthlyIncome(
        ctx,
        'person-1',
        new Date('2026-07-01T00:00:00+03:00'),
        new Date('2026-07-31T00:00:00+03:00'),
      );

      expect(july.salaryAmount.amountMinor).toBe(3000n);
      expect(july.penaltyAmount.amountMinor).toBe(0n);
      const sources = (
        jest.mocked(prisma.customerTransaction.findMany).mock.calls[0][0] as any
      ).where.source.in as number[];
      expect(sources).toEqual(
        expect.arrayContaining([
          CustomerTransactionSource.Bonus,
          CustomerTransactionSource.PieceworkCorrection,
        ]),
      );
      expect(sources).not.toContain(CustomerTransactionSource.Manual);
      expect(sources).not.toContain(CustomerTransactionSource.ManualWithoutWallet);
    });
  });

  describe('getSourceDisplay', () => {
    it('OrderSalary → контекст заказа для зарплаты', async () => {
      display.getOrderContextByOrderIdForSalary.mockResolvedValue('Авто | A123');
      const res = await service.getSourceDisplay(
        ctx,
        CustomerTransactionSource.OrderSalary,
        'order-1',
      );
      expect(res).toBe('Авто | A123');
    });

    it('заказные источники → getOrderContext', async () => {
      display.getOrderContext.mockResolvedValue('№1, Иванов');
      const res = await service.getSourceDisplay(
        ctx,
        CustomerTransactionSource.OrderPayment,
        'order-1',
      );
      expect(res).toBe('№1, Иванов');
    });

    it('Penalty/ManualWithoutWallet → пустая строка', async () => {
      const res = await service.getSourceDisplay(
        ctx,
        CustomerTransactionSource.Penalty,
        'x',
      );
      expect(res).toBe('');
    });

    it('WarrantyDeduction → контекст заказа по id позиции (не orderId)', async () => {
      display.getOrderContextByOrderItemId.mockResolvedValue('№1, Иванов');
      const res = await service.getSourceDisplay(
        ctx,
        CustomerTransactionSource.WarrantyDeduction,
        'order-item-1',
      );
      expect(display.getOrderContextByOrderItemId).toHaveBeenCalledWith(
        ctx,
        'order-item-1',
      );
      expect(res).toBe('№1, Иванов');
    });

    it('WarrantySalaryCompensation/WarrantyMarginDeduction → контекст заказа по id позиции', async () => {
      display.getOrderContextByOrderItemId.mockResolvedValue('№1, Иванов');
      for (const source of [
        CustomerTransactionSource.WarrantySalaryCompensation,
        CustomerTransactionSource.WarrantyMarginDeduction,
      ]) {
        const res = await service.getSourceDisplay(ctx, source, 'order-item-1');
        expect(res).toBe('№1, Иванов');
      }
      expect(display.getOrderContextByOrderItemId).toHaveBeenCalledTimes(2);
    });
  });

  describe('findByOrderId', () => {
    it('возвращает заказные проводки и удержания за гарантию по позициям заказа', async () => {
      jest.mocked(prisma.orderItem.findMany).mockResolvedValue([
        { id: 'item-1' },
        { id: 'item-2' },
      ] as any);
      jest.mocked(prisma.customerTransaction.findMany)
        .mockResolvedValueOnce([
          {
            id: 'ct-salary',
            source: CustomerTransactionSource.OrderSalary,
            sourceId: 'order-1',
            createdAt: new Date('2026-07-01T10:00:00Z'),
          },
        ] as any)
        .mockResolvedValueOnce([
          {
            id: 'ct-warranty',
            source: CustomerTransactionSource.WarrantyDeduction,
            sourceId: 'item-1',
            createdAt: new Date('2026-07-01T12:00:00Z'),
          },
        ] as any);

      const result = await service.findByOrderId(ctx, 'order-1');

      expect(prisma.orderItem.findMany).toHaveBeenCalledWith({
        where: { orderId: 'order-1', tenantId: ctx.tenantId },
        select: { id: true },
      });
      expect(prisma.customerTransaction.findMany).toHaveBeenNthCalledWith(1, {
        where: {
          tenantId: ctx.tenantId,
          sourceId: 'order-1',
          source: {
            in: [
              CustomerTransactionSource.OrderPrepay,
              CustomerTransactionSource.OrderDebit,
              CustomerTransactionSource.OrderPayment,
              CustomerTransactionSource.OrderPrepayRefund,
              CustomerTransactionSource.OrderSalary,
              CustomerTransactionSource.OrderMotivation,
            ],
          },
        },
      });
      expect(prisma.customerTransaction.findMany).toHaveBeenNthCalledWith(2, {
        where: {
          tenantId: ctx.tenantId,
          source: {
            in: [
              CustomerTransactionSource.WarrantyDeduction,
              CustomerTransactionSource.WarrantySalaryCompensation,
              CustomerTransactionSource.WarrantyMarginDeduction,
            ],
          },
          sourceId: { in: ['item-1', 'item-2'] },
        },
      });
      expect(result.map((t) => t.id)).toEqual(['ct-warranty', 'ct-salary']);
    });
  });

  describe('createManualTransaction', () => {
    it('Payroll без счёта → BadRequest', async () => {
      await expect(
        service.createManualTransaction(ctx, {
          operandId: 'person-1',
          source: CustomerTransactionSource.Payroll,
          amount: { amountMinor: 100n, currencyCode: 'RUB' },
        } as any),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it.each([0n, -100n])('Bonus с суммой %s → BadRequest', async (amountMinor) => {
      await expect(
        service.createManualTransaction(ctx, {
          operandId: 'person-1',
          source: CustomerTransactionSource.Bonus,
          amount: { amountMinor, currencyCode: 'RUB' },
        } as any),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('PieceworkCorrection с нулевой суммой → BadRequest', async () => {
      await expect(
        service.createManualTransaction(ctx, {
          operandId: 'person-1',
          source: CustomerTransactionSource.PieceworkCorrection,
          amount: { amountMinor: 0n, currencyCode: 'RUB' },
        } as any),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it.each([CustomerTransactionSource.Bonus, CustomerTransactionSource.PieceworkCorrection])(
      'источник %s со счётом → BadRequest',
      async (source) => {
        await expect(
          service.createManualTransaction(ctx, {
            operandId: 'person-1',
            source,
            walletId: 'wallet-1',
            amount: { amountMinor: 100n, currencyCode: 'RUB' },
          } as any),
        ).rejects.toBeInstanceOf(BadRequestException);
        expect(prisma.customerTransaction.create.mock.calls).toHaveLength(0);
      },
    );

    it.each([
      [CustomerTransactionSource.Bonus, 100n],
      [CustomerTransactionSource.PieceworkCorrection, -100n],
    ])('источник %s без счёта сохраняется как есть', async (source, amountMinor) => {
      jest.mocked(prisma.customerTransaction.create).mockResolvedValue({ id: 'ct1' } as any);

      await service.createManualTransaction(ctx, {
        operandId: 'person-1',
        source,
        amount: { amountMinor, currencyCode: 'RUB' },
      } as any);

      expect(prisma.customerTransaction.create.mock.calls[0][0].data).toMatchObject({
        source,
        sourceId: ctx.userId,
        amountAmount: amountMinor,
      });
    });
  });
});
