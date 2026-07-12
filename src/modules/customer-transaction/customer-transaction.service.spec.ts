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
      prisma.customerTransaction.create.mockResolvedValue({ id: 'ct1' } as any);

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

      expect(prisma.customerTransaction.create.mock.calls[0][0].data).toMatchObject({
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
      prisma.customerTransaction.aggregate.mockResolvedValue({
        _sum: { amountAmount: 1500n },
      } as any);
      expect(await service.getBalance(ctx, 'person-1')).toBe(1500n);

      prisma.customerTransaction.aggregate.mockResolvedValue({
        _sum: { amountAmount: null },
      } as any);
      expect(await service.getBalance(ctx, 'person-1')).toBe(0n);
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
  });

  describe('findByOrderId', () => {
    it('возвращает заказные проводки и удержания за гарантию по позициям заказа', async () => {
      prisma.orderItem.findMany.mockResolvedValue([
        { id: 'item-1' },
        { id: 'item-2' },
      ] as any);
      prisma.customerTransaction.findMany
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
            ],
          },
        },
      });
      expect(prisma.customerTransaction.findMany).toHaveBeenNthCalledWith(2, {
        where: {
          tenantId: ctx.tenantId,
          source: CustomerTransactionSource.WarrantyDeduction,
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
  });
});
