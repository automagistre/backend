import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateExpenseInput } from './inputs/create-expense.input';
import { UpdateExpenseInput } from './inputs/update-expense.input';
import { CreateExpenseTransactionInput } from './inputs/create-expense-transaction.input';
import { WalletTransactionSource } from 'src/modules/wallet/enums/wallet-transaction-source.enum';
import { WalletService } from 'src/modules/wallet/wallet.service';
import { WalletTransactionService } from 'src/modules/wallet/wallet-transaction.service';
import type { AuthContext } from 'src/common/user-id.store';

const DEFAULT_TAKE = 25;
const DEFAULT_SKIP = 0;

@Injectable()
export class ExpenseService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly walletService: WalletService,
    private readonly walletTransactionService: WalletTransactionService,
  ) {}

  async create(ctx: AuthContext, data: CreateExpenseInput) {
    const { tenantId, userId } = ctx;
    if (data.walletId != null) {
      const wallet = await this.walletService.findOne(data.walletId);
      if (!wallet) throw new NotFoundException('Счёт не найден');
    }
    return this.prisma.expense.create({
      data: {
        name: data.name.trim(),
        walletId: data.walletId ?? null,
        tenantId,
        createdBy: userId,
      },
      include: { wallet: true },
    });
  }

  async update(ctx: AuthContext, input: UpdateExpenseInput) {
    const existing = await this.findOne(ctx, input.id);
    if (!existing) throw new NotFoundException('Статья расходов не найдена');
    if (input.walletId != null) {
      const wallet = await this.walletService.findOne(input.walletId);
      if (!wallet) throw new NotFoundException('Счёт не найден');
    }
    const data: { name?: string; walletId?: string | null } = {};
    if (input.name !== undefined) data.name = input.name.trim();
    if (input.walletId !== undefined) data.walletId = input.walletId ?? null;
    return this.prisma.expense.update({
      where: { id: input.id },
      data,
      include: { wallet: true },
    });
  }

  async findMany(
    ctx: AuthContext,
    {
      take = DEFAULT_TAKE,
      skip = DEFAULT_SKIP,
      search,
    }: {
      take?: number;
      skip?: number;
      search?: string;
    },
  ) {
    const { tenantId } = ctx;
    const where = {
      tenantId,
      ...(search
        ? { name: { contains: search, mode: 'insensitive' as const } }
        : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.expense.findMany({
        where,
        take: +take,
        skip: +skip,
        orderBy: { name: 'asc' },
        include: { wallet: true },
      }),
      this.prisma.expense.count({ where }),
    ]);
    return { items, total };
  }

  async findOne(ctx: AuthContext, id: string) {
    const { tenantId } = ctx;
    return this.prisma.expense.findFirst({
      where: { id, tenantId },
      include: { wallet: true },
    });
  }

  async remove(ctx: AuthContext, id: string) {
    const expense = await this.findOne(ctx, id);
    if (!expense) throw new NotFoundException('Статья расходов не найдена');
    const txCount = await this.prisma.walletTransaction.count({
      where: {
        source: WalletTransactionSource.Expense,
        sourceId: id,
      },
    });
    if (txCount > 0) {
      throw new ConflictException(
        'Нельзя удалить статью расходов: по ней уже есть проводки',
      );
    }
    return this.prisma.expense.delete({
      where: { id },
    });
  }

  async createExpenseTransaction(ctx: AuthContext, input: CreateExpenseTransactionInput) {
    const expense = await this.findOne(ctx, input.expenseId);
    if (!expense) throw new NotFoundException('Статья расходов не найдена');
    const wallet = await this.walletService.findOne(input.walletId);
    if (!wallet) throw new NotFoundException('Счёт не найден');
    const amountMinor =
      input.amount.amountMinor > 0n
        ? -input.amount.amountMinor
        : input.amount.amountMinor;
    return this.walletTransactionService.create({
      walletId: input.walletId,
      source: WalletTransactionSource.Expense,
      sourceId: input.expenseId,
      description: input.description ?? null,
      amount: {
        amountMinor,
        currencyCode: input.amount.currencyCode ?? undefined,
      },
    });
  }
}
