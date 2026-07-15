import { mockDeep, type DeepMockProxy } from 'jest-mock-extended';
import {
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { ExpenseService } from './expense.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { WalletService } from 'src/modules/wallet/wallet.service';
import { WalletTransactionService } from 'src/modules/wallet/wallet-transaction.service';
import { WalletTransactionSource } from 'src/modules/wallet/enums/wallet-transaction-source.enum';
import { createPrismaMock, type PrismaMock } from 'src/common/testing/prisma-mock';
import { makeCtx } from 'src/common/testing/auth-context';

describe('ExpenseService', () => {
  let prisma: PrismaMock;
  let wallet: DeepMockProxy<WalletService>;
  let walletTx: DeepMockProxy<WalletTransactionService>;
  let service: ExpenseService;
  const ctx = makeCtx();

  beforeEach(() => {
    prisma = createPrismaMock();
    wallet = mockDeep<WalletService>();
    walletTx = mockDeep<WalletTransactionService>();
    service = new ExpenseService(
      prisma as unknown as PrismaService,
      wallet as unknown as WalletService,
      walletTx as unknown as WalletTransactionService,
    );
  });

  describe('create', () => {
    it('тримит имя и не проверяет счёт, если walletId не задан', async () => {
      jest.mocked(prisma.expense.create).mockResolvedValue({ id: 'e1' } as any);
      await service.create(ctx, { name: '  Аренда  ' } as any);
      const arg = jest.mocked(prisma.expense.create).mock.calls[0][0].data as any;
      expect(arg.name).toBe('Аренда');
      expect(wallet.findOne).not.toHaveBeenCalled();
    });

    it('бросает NotFound, если указанный счёт не найден', async () => {
      wallet.findOne.mockResolvedValue(null as any);
      await expect(
        service.create(ctx, { name: 'X', walletId: 'w1' } as any),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('remove', () => {
    it('бросает NotFound, если статьи нет', async () => {
      jest.mocked(prisma.expense.findFirst).mockResolvedValue(null as any);
      await expect(service.remove(ctx, 'e1')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('бросает Conflict, если есть проводки', async () => {
      jest.mocked(prisma.expense.findFirst).mockResolvedValue({ id: 'e1' } as any);
      jest.mocked(prisma.walletTransaction.count).mockResolvedValue(2 as any);
      await expect(service.remove(ctx, 'e1')).rejects.toBeInstanceOf(
        ConflictException,
      );
    });

    it('удаляет, если проводок нет', async () => {
      jest.mocked(prisma.expense.findFirst).mockResolvedValue({ id: 'e1' } as any);
      jest.mocked(prisma.walletTransaction.count).mockResolvedValue(0 as any);
      jest.mocked(prisma.expense.delete).mockResolvedValue({ id: 'e1' } as any);
      await service.remove(ctx, 'e1');
      expect(prisma.expense.delete).toHaveBeenCalledWith({ where: { id: 'e1' } });
    });
  });

  describe('createExpenseTransaction', () => {
    it('NotFound, если статьи нет', async () => {
      jest.mocked(prisma.expense.findFirst).mockResolvedValue(null as any);
      await expect(
        service.createExpenseTransaction(ctx, {
          expenseId: 'e1',
          walletId: 'w1',
          amount: { amountMinor: 100n, currencyCode: 'RUB' },
        } as any),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('конвертирует положительную сумму в отрицательную проводку Expense', async () => {
      jest.mocked(prisma.expense.findFirst).mockResolvedValue({ id: 'e1' } as any);
      wallet.findOne.mockResolvedValue({ id: 'w1' } as any);

      await service.createExpenseTransaction(ctx, {
        expenseId: 'e1',
        walletId: 'w1',
        amount: { amountMinor: 5000n, currencyCode: 'RUB' },
      } as any);

      const arg = walletTx.create.mock.calls[0][1] as any;
      expect(arg.source).toBe(WalletTransactionSource.Expense);
      expect(arg.amount.amountMinor).toBe(-5000n);
    });
  });
});
