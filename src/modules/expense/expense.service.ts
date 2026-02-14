import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { TenantService } from 'src/common/services/tenant.service';
import { CreateExpenseInput } from './inputs/create-expense.input';
import { UpdateExpenseInput } from './inputs/update-expense.input';
import { CreateExpenseTransactionInput } from './inputs/create-expense-transaction.input';
import { WalletTransactionSource } from 'src/modules/wallet/enums/wallet-transaction-source.enum';
import { WalletService } from 'src/modules/wallet/wallet.service';
import { WalletTransactionService } from 'src/modules/wallet/wallet-transaction.service';

const DEFAULT_TAKE = 25;
const DEFAULT_SKIP = 0;

@Injectable()
export class ExpenseService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantService: TenantService,
    private readonly walletService: WalletService,
    private readonly walletTransactionService: WalletTransactionService,
  ) {}

  async create(data: CreateExpenseInput) {
    const tenantId = await this.tenantService.getTenantId();
    if (data.walletId != null) {
      const wallet = await this.walletService.findOne(data.walletId);
      if (!wallet) throw new NotFoundException('Счёт не найден');
    }
    return this.prisma.expense.create({
      data: {
        name: data.name.trim(),
        walletId: data.walletId ?? null,
        tenantId,
      },
      include: { wallet: true },
    });
  }

  async update(input: UpdateExpenseInput) {
    const existing = await this.findOne(input.id);
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

  async findMany({
    take = DEFAULT_TAKE,
    skip = DEFAULT_SKIP,
    search,
  }: {
    take?: number;
    skip?: number;
    search?: string;
  }) {
    const tenantId = await this.tenantService.getTenantId();
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

  async findOne(id: string) {
    const tenantId = await this.tenantService.getTenantId();
    return this.prisma.expense.findFirst({
      where: { id, tenantId },
      include: { wallet: true },
    });
  }

  async remove(id: string) {
    const expense = await this.findOne(id);
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

  async createExpenseTransaction(input: CreateExpenseTransactionInput) {
    const expense = await this.findOne(input.expenseId);
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
