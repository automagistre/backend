import { mockDeep, type DeepMockProxy } from 'jest-mock-extended';
import { NotFoundException } from '@nestjs/common';
import { WalletTransactionService } from './wallet-transaction.service';
import { WalletService } from './wallet.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { DisplayContextService } from 'src/modules/display-context/display-context.service';
import { SettingsService } from 'src/modules/settings/settings.service';
import { AuditLogService } from 'src/modules/audit-log/audit-log.service';
import { WalletTransactionSource } from './enums/wallet-transaction-source.enum';
import { AuditAction } from 'src/modules/audit-log/enums/audit.enums';
import { createPrismaMock, type PrismaMock } from 'src/common/testing/prisma-mock';
import { makeCtx } from 'src/common/testing/auth-context';

describe('WalletTransactionService', () => {
  let prisma: PrismaMock;
  let wallet: DeepMockProxy<WalletService>;
  let display: DeepMockProxy<DisplayContextService>;
  let settings: DeepMockProxy<SettingsService>;
  let audit: DeepMockProxy<AuditLogService>;
  let service: WalletTransactionService;
  const ctx = makeCtx();

  beforeEach(() => {
    prisma = createPrismaMock();
    wallet = mockDeep<WalletService>();
    display = mockDeep<DisplayContextService>();
    settings = mockDeep<SettingsService>();
    audit = mockDeep<AuditLogService>();
    settings.getDefaultCurrencyCode.mockResolvedValue('RUB');

    service = new WalletTransactionService(
      prisma as unknown as PrismaService,
      wallet as unknown as WalletService,
      display as unknown as DisplayContextService,
      settings as unknown as SettingsService,
      audit as unknown as AuditLogService,
    );
  });

  describe('create', () => {
    it('бросает NotFound, если счёт не найден', async () => {
      wallet.findOne.mockResolvedValue(null as any);
      await expect(
        service.create(ctx, {
          walletId: 'w1',
          source: WalletTransactionSource.OrderDebit,
          sourceId: 'order-1',
          amount: { amountMinor: 100n, currencyCode: 'RUB' },
        } as any),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('OrderDebit → пишет проводку и аудит DEBIT', async () => {
      wallet.findOne.mockResolvedValue({ id: 'w1' } as any);
      prisma.walletTransaction.create.mockResolvedValue({
        id: 'wt1',
        source: WalletTransactionSource.OrderDebit,
        sourceId: 'order-1',
      } as any);
      prisma.order.findUnique.mockResolvedValue({ customerId: 'c1' } as any);
      display.getOperandDisplayName.mockResolvedValue('Иванов Иван');

      await service.create(ctx, {
        walletId: 'w1',
        source: WalletTransactionSource.OrderDebit,
        sourceId: 'order-1',
        amount: { amountMinor: 5000n, currencyCode: 'RUB' },
      } as any);

      expect(audit.record).toHaveBeenCalledTimes(1);
      expect(audit.record.mock.calls[0][2].action).toBe(AuditAction.DEBIT);
    });

    it('OrderPrepay с отрицательной суммой → аудит REFUND', async () => {
      wallet.findOne.mockResolvedValue({ id: 'w1' } as any);
      prisma.walletTransaction.create.mockResolvedValue({
        id: 'wt1',
        source: WalletTransactionSource.OrderPrepay,
        sourceId: 'order-1',
      } as any);
      prisma.order.findUnique.mockResolvedValue({ customerId: null } as any);

      await service.create(ctx, {
        walletId: 'w1',
        source: WalletTransactionSource.OrderPrepay,
        sourceId: 'order-1',
        amount: { amountMinor: -5000n, currencyCode: 'RUB' },
      } as any);

      expect(audit.record.mock.calls[0][2].action).toBe(AuditAction.REFUND);
    });

    it('неордерный источник (Initial) → без аудита', async () => {
      wallet.findOne.mockResolvedValue({ id: 'w1' } as any);
      prisma.walletTransaction.create.mockResolvedValue({
        id: 'wt1',
        source: WalletTransactionSource.Initial,
        sourceId: 'x',
      } as any);

      await service.create(ctx, {
        walletId: 'w1',
        source: WalletTransactionSource.Initial,
        amount: { amountMinor: 100n, currencyCode: 'RUB' },
      } as any);

      expect(audit.record).not.toHaveBeenCalled();
    });
  });

  describe('getSourceDisplay', () => {
    it('ордерные источники → getOrderContext', async () => {
      display.getOrderContext.mockResolvedValue('№1, Иванов');
      expect(
        await service.getSourceDisplay(
          ctx,
          WalletTransactionSource.OrderPrepay,
          'order-1',
        ),
      ).toBe('№1, Иванов');
    });

    it('Payroll → операнд связанной проводки клиента', async () => {
      prisma.customerTransaction.findFirst.mockResolvedValue({
        operandId: 'person-1',
      } as any);
      display.getOperandDisplayName.mockResolvedValue('Петров Пётр');
      expect(
        await service.getSourceDisplay(ctx, WalletTransactionSource.Payroll, 'ct1'),
      ).toBe('Петров Пётр');
    });

    it('Expense → название статьи; Initial → пустая строка', async () => {
      display.getExpenseName.mockResolvedValue('Аренда');
      expect(
        await service.getSourceDisplay(ctx, WalletTransactionSource.Expense, 'e1'),
      ).toBe('Аренда');
      expect(
        await service.getSourceDisplay(ctx, WalletTransactionSource.Initial, 'x'),
      ).toBe('');
    });
  });
});
