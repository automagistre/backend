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

  describe('syncContractorPayout', () => {
    const source = (over: Record<string, any> = {}) => ({
      serviceId: 'svc-1',
      orderId: 'order-1',
      serviceName: 'Ремонт генератора',
      kind: 'CONTRACTOR',
      executorKind: 'ORGANIZATION',
      executorId: 'org-1',
      costAmount: 500000n,
      costCurrencyCode: 'RUB',
      costWalletId: 'w1',
      ...over,
    });

    beforeEach(() => {
      display.getPartyDisplay.mockResolvedValue('ИП Иванов');
    });

    it('создаёт проводку с отрицательной суммой и аудитом CREATE', async () => {
      prisma.walletTransaction.findFirst.mockResolvedValue(null);
      prisma.walletTransaction.create.mockResolvedValue({ id: 'wt1' } as any);

      await service.syncContractorPayout(prisma as any, ctx, source());

      const data = prisma.walletTransaction.create.mock.calls[0][0].data as any;
      expect(data).toMatchObject({
        walletId: 'w1',
        source: WalletTransactionSource.ContractorPayout,
        sourceId: 'svc-1',
        amountAmount: -500000n,
        amountCurrencyCode: 'RUB',
      });
      expect(audit.record).toHaveBeenCalledTimes(1);
      expect(audit.record.mock.calls[0][2].action).toBe(AuditAction.CREATE);
    });

    it('обновляет проводку при изменении суммы/счёта и пишет аудит UPDATE', async () => {
      prisma.walletTransaction.findFirst.mockResolvedValue({
        id: 'wt1',
        walletId: 'w1',
        amountAmount: -300000n,
        amountCurrencyCode: 'RUB',
      } as any);

      await service.syncContractorPayout(prisma as any, ctx, source());

      expect(prisma.walletTransaction.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'wt1' },
          data: expect.objectContaining({
            walletId: 'w1',
            amountAmount: -500000n,
          }),
        }),
      );
      expect(audit.record.mock.calls[0][2].action).toBe(AuditAction.UPDATE);
    });

    it('без изменений — не трогает проводку и аудит', async () => {
      prisma.walletTransaction.findFirst.mockResolvedValue({
        id: 'wt1',
        walletId: 'w1',
        amountAmount: -500000n,
        amountCurrencyCode: 'RUB',
      } as any);

      await service.syncContractorPayout(prisma as any, ctx, source());

      expect(prisma.walletTransaction.update).not.toHaveBeenCalled();
      expect(prisma.walletTransaction.delete).not.toHaveBeenCalled();
      expect(audit.record).not.toHaveBeenCalled();
    });

    it('удаляет проводку при обнулении себестоимости с аудитом DELETE', async () => {
      prisma.walletTransaction.findFirst.mockResolvedValue({
        id: 'wt1',
        walletId: 'w1',
        amountAmount: -500000n,
        amountCurrencyCode: 'RUB',
      } as any);

      await service.syncContractorPayout(
        prisma as any,
        ctx,
        source({ costAmount: null }),
      );

      expect(prisma.walletTransaction.delete).toHaveBeenCalledWith({
        where: { id: 'wt1' },
      });
      expect(audit.record.mock.calls[0][2].action).toBe(AuditAction.DELETE);
    });

    it('удаляет проводку при смене вида на AUTOSERVICE', async () => {
      prisma.walletTransaction.findFirst.mockResolvedValue({
        id: 'wt1',
        walletId: 'w1',
        amountAmount: -500000n,
        amountCurrencyCode: 'RUB',
      } as any);

      await service.syncContractorPayout(
        prisma as any,
        ctx,
        source({ kind: 'AUTOSERVICE' }),
      );

      expect(prisma.walletTransaction.delete).toHaveBeenCalledTimes(1);
    });

    it('не подрядная работа без проводки — no-op', async () => {
      prisma.walletTransaction.findFirst.mockResolvedValue(null);

      await service.syncContractorPayout(
        prisma as any,
        ctx,
        source({ kind: 'AUTOSERVICE', costAmount: null, costWalletId: null }),
      );

      expect(prisma.walletTransaction.create).not.toHaveBeenCalled();
      expect(audit.record).not.toHaveBeenCalled();
    });

    it('гарантия по вине подрядчика (EXECUTOR) — удаляет проводку', async () => {
      prisma.walletTransaction.findFirst.mockResolvedValue({
        id: 'wt1',
        walletId: 'w1',
        amountAmount: -500000n,
        amountCurrencyCode: 'RUB',
      } as any);

      await service.syncContractorPayout(
        prisma as any,
        ctx,
        source({ warranty: true, warrantyPayer: 'EXECUTOR' }),
      );

      expect(prisma.walletTransaction.delete).toHaveBeenCalledWith({
        where: { id: 'wt1' },
      });
      expect(audit.record.mock.calls[0][2].action).toBe(AuditAction.DELETE);
    });

    it('гарантия по вине подрядчика (EXECUTOR) без проводки — не создаёт', async () => {
      prisma.walletTransaction.findFirst.mockResolvedValue(null);

      await service.syncContractorPayout(
        prisma as any,
        ctx,
        source({ warranty: true, warrantyPayer: 'EXECUTOR' }),
      );

      expect(prisma.walletTransaction.create).not.toHaveBeenCalled();
    });

    it('гарантия по вине организации (ORGANIZATION) — проводка создаётся как обычно', async () => {
      prisma.walletTransaction.findFirst.mockResolvedValue(null);
      prisma.walletTransaction.create.mockResolvedValue({ id: 'wt1' } as any);

      await service.syncContractorPayout(
        prisma as any,
        ctx,
        source({ warranty: true, warrantyPayer: 'ORGANIZATION' }),
      );

      expect(prisma.walletTransaction.create).toHaveBeenCalledTimes(1);
    });
  });

  describe('removeContractorPayouts', () => {
    it('удаляет проводки по работам и пишет аудит DELETE на каждую', async () => {
      prisma.walletTransaction.findMany.mockResolvedValue([
        {
          id: 'wt1',
          amountAmount: -100n,
          amountCurrencyCode: 'RUB',
          description: 'Оплата подрядчику: Работа',
        },
        {
          id: 'wt2',
          amountAmount: -200n,
          amountCurrencyCode: 'RUB',
          description: null,
        },
      ] as any);

      await service.removeContractorPayouts(prisma as any, ctx, 'order-1', [
        'svc-1',
        'svc-2',
      ]);

      expect(prisma.walletTransaction.delete).toHaveBeenCalledTimes(2);
      expect(audit.record).toHaveBeenCalledTimes(2);
      expect(audit.record.mock.calls[0][2].action).toBe(AuditAction.DELETE);
    });

    it('пустой список работ — no-op', async () => {
      await service.removeContractorPayouts(prisma as any, ctx, 'order-1', []);
      expect(prisma.walletTransaction.findMany).not.toHaveBeenCalled();
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
