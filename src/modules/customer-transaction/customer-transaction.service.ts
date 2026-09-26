import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from 'src/generated/prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { WalletService } from 'src/modules/wallet/wallet.service';
import { WalletTransactionService } from 'src/modules/wallet/wallet-transaction.service';
import { WalletTransactionSource } from 'src/modules/wallet/enums/wallet-transaction-source.enum';
import { DisplayContextService } from 'src/modules/display-context/display-context.service';
import { CreateCustomerTransactionInput } from './inputs/create-customer-transaction.input';
import { CreateManualCustomerTransactionInput } from './inputs/create-manual-customer-transaction.input';
import {
  CustomerTransactionSource,
  SALARY_INCOME_SOURCES,
  SALARY_NET_SOURCES,
} from './enums/customer-transaction-source.enum';
import { SettingsService } from 'src/modules/settings/settings.service';
import { applyDefaultCurrency } from 'src/common/money';
import type { AuthContext } from 'src/common/user-id.store';
import { PersonMonthlyIncomeModel } from './models/person-monthly-income.model';
import { toZonedParts, zonedToUtc } from 'src/common/utils/zoned-time.util';

const DEFAULT_TAKE = 25;
const DEFAULT_SKIP = 0;

const ORDER_SOURCES = [
  CustomerTransactionSource.OrderPrepay,
  CustomerTransactionSource.OrderDebit,
  CustomerTransactionSource.OrderPayment,
  CustomerTransactionSource.OrderPrepayRefund,
  CustomerTransactionSource.OrderSalary,
];

/** Проводки по гарантии: sourceId = orderItemService.id | orderItemPart.id */
const WARRANTY_SOURCES = [
  CustomerTransactionSource.WarrantyDeduction,
  CustomerTransactionSource.WarrantySalaryCompensation,
  CustomerTransactionSource.WarrantyMarginDeduction,
];

@Injectable()
export class CustomerTransactionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly walletService: WalletService,
    private readonly walletTransactionService: WalletTransactionService,
    private readonly displayContextService: DisplayContextService,
    private readonly settingsService: SettingsService,
  ) {}

  /**
   * Создание проводки внутри переданной транзакции (для CloseOrder).
   * Не вызывать при createPrepay/refundPrepay — проводки по клиенту переносятся только при закрытии заказа.
   * @param tx - Prisma transaction client
   * @param data - данные проводки
   * @param tenantId - ID тенанта (из ctx.tenantId)
   * @param createdBy - ID пользователя (из ctx.userId)
   */
  async createWithinTransaction(
    tx: Prisma.TransactionClient,
    data: CreateCustomerTransactionInput,
    tenantId: string,
    createdBy: string,
  ) {
    const defaultCurrency =
      await this.settingsService.getDefaultCurrencyCode(tenantId);
    const moneyData =
      data.amount != null
        ? applyDefaultCurrency(data.amount, defaultCurrency)
        : { amountMinor: 0n, currencyCode: defaultCurrency };

    return tx.customerTransaction.create({
      data: {
        operandId: data.operandId,
        source: data.source,
        sourceId: data.sourceId,
        description: data.description ?? null,
        amountAmount: moneyData.amountMinor,
        amountCurrencyCode: moneyData.currencyCode,
        tenantId,
        createdBy,
      },
    });
  }

  /**
   * Создание одной проводки без внешней транзакции (для фонового job, напр. начисление зарплаты по заказу).
   */
  async create(ctx: AuthContext, data: CreateCustomerTransactionInput) {
    const { tenantId, userId } = ctx;
    const defaultCurrency = await this.settingsService.getDefaultCurrencyCode(
      ctx.tenantId,
    );
    const moneyData =
      data.amount != null
        ? applyDefaultCurrency(data.amount, defaultCurrency)
        : { amountMinor: 0n, currencyCode: defaultCurrency };

    return this.prisma.customerTransaction.create({
      data: {
        operandId: data.operandId,
        source: data.source,
        sourceId: data.sourceId,
        description: data.description ?? null,
        amountAmount: moneyData.amountMinor,
        amountCurrencyCode: moneyData.currencyCode,
        tenantId,
        createdBy: userId,
      },
    });
  }

  async findMany(
    ctx: AuthContext,
    {
      take = DEFAULT_TAKE,
      skip = DEFAULT_SKIP,
      operandId,
      dateFrom,
      dateTo,
    }: {
      take?: number;
      skip?: number;
      operandId: string;
      dateFrom?: Date;
      dateTo?: Date;
    },
  ) {
    const where: Prisma.CustomerTransactionWhereInput = {
      tenantId: ctx.tenantId,
      operandId,
    };
    if (dateFrom ?? dateTo) {
      where.createdAt = {};
      if (dateFrom) (where.createdAt as Prisma.DateTimeFilter).gte = dateFrom;
      if (dateTo) (where.createdAt as Prisma.DateTimeFilter).lte = dateTo;
    }
    const [items, total] = await Promise.all([
      this.prisma.customerTransaction.findMany({
        where,
        take: +take,
        skip: +skip,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.customerTransaction.count({ where }),
    ]);
    return { items, total };
  }

  /** Проводки по заказу: заказные (sourceId = orderId) и удержания за гарантию (sourceId = orderItem.id). */
  async findByOrderId(ctx: AuthContext, orderId: string) {
    const { tenantId } = ctx;

    const orderItems = await this.prisma.orderItem.findMany({
      where: { orderId, tenantId },
      select: { id: true },
    });
    const orderItemIds = orderItems.map((item) => item.id);

    const [orderLinked, warrantyLinked] = await Promise.all([
      this.prisma.customerTransaction.findMany({
        where: {
          tenantId,
          sourceId: orderId,
          source: { in: ORDER_SOURCES },
        },
      }),
      orderItemIds.length > 0
        ? this.prisma.customerTransaction.findMany({
            where: {
              tenantId,
              source: { in: WARRANTY_SOURCES },
              sourceId: { in: orderItemIds },
            },
          })
        : Promise.resolve([]),
    ]);

    return [...orderLinked, ...warrantyLinked].sort(
      (a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0),
    );
  }

  async getBalance(ctx: AuthContext, operandId: string): Promise<bigint> {
    const result = await this.prisma.customerTransaction.aggregate({
      where: { operandId, tenantId: ctx.tenantId },
      _sum: { amountAmount: true },
    });
    return result._sum.amountAmount ?? BigInt(0);
  }

  /**
   * Помесячные начисления ЗП и удержания по операнду.
   * Месяцы без проводок в диапазоне — нули.
   */
  async getMonthlyIncome(
    ctx: AuthContext,
    operandId: string,
    dateFrom: Date,
    dateTo: Date,
  ): Promise<PersonMonthlyIncomeModel[]> {
    const [tz, currencyCode] = await Promise.all([
      this.settingsService.getTimezone(ctx.tenantId),
      this.settingsService.getDefaultCurrencyCode(ctx.tenantId),
    ]);

    const rows = await this.prisma.customerTransaction.findMany({
      where: {
        tenantId: ctx.tenantId,
        operandId,
        source: { in: [...SALARY_NET_SOURCES] },
        createdAt: { gte: dateFrom, lte: dateTo },
      },
      select: {
        createdAt: true,
        source: true,
        amountAmount: true,
      },
    });

    const incomeSources = new Set<number>(SALARY_INCOME_SOURCES);
    const byMonth = new Map<string, { salary: bigint; penalty: bigint }>();
    for (const row of rows) {
      if (!row.createdAt) continue;
      const z = toZonedParts(row.createdAt, tz);
      const key = `${z.year}-${String(z.month).padStart(2, '0')}`;
      const amounts = byMonth.get(key) ?? { salary: 0n, penalty: 0n };
      const amount = row.amountAmount ?? 0n;
      if (incomeSources.has(row.source)) {
        amounts.salary += amount;
      } else {
        amounts.penalty += amount;
      }
      byMonth.set(key, amounts);
    }

    const money = (amountMinor: bigint) => ({
      amountMinor,
      currencyCode,
    });

    return monthsInRange(dateFrom, dateTo, tz).map((month) => {
      const z = toZonedParts(month, tz);
      const key = `${z.year}-${String(z.month).padStart(2, '0')}`;
      const amounts = byMonth.get(key) ?? { salary: 0n, penalty: 0n };
      return {
        month,
        salaryAmount: money(amounts.salary),
        penaltyAmount: money(amounts.penalty),
        netAmount: money(amounts.salary + amounts.penalty),
      };
    });
  }

  async getOperandDisplayName(operandId: string): Promise<string | null> {
    return this.displayContextService.getOperandDisplayName(operandId);
  }

  /**
   * Контекстная строка для отображения проводки по операнду.
   */
  async getSourceDisplay(
    ctx: AuthContext,
    source: number,
    sourceId: string,
  ): Promise<string> {
    if (source === CustomerTransactionSource.OrderSalary) {
      return this.displayContextService.getOrderContextByOrderIdForSalary(
        ctx,
        sourceId,
      );
    }
    if (ORDER_SOURCES.includes(source as CustomerTransactionSource)) {
      return this.displayContextService.getOrderContext(ctx, sourceId);
    }
    if (WARRANTY_SOURCES.includes(source as CustomerTransactionSource)) {
      // sourceId = orderItemService.id | orderItemPart.id (не orderId).
      return this.displayContextService.getOrderContextByOrderItemId(
        ctx,
        sourceId,
      );
    }
    if (
      source === CustomerTransactionSource.Manual ||
      source === CustomerTransactionSource.Payroll
    ) {
      return this.displayContextService.getWalletNameByWalletTransactionId(
        ctx,
        sourceId,
      );
    }
    // Для ManualWithoutWallet и Penalty контекстной строки нет — клиент
    // отображает только базовую метку источника, чтобы не дублировать её.
    return '';
  }

  async createManualTransaction(
    ctx: AuthContext,
    input: CreateManualCustomerTransactionInput,
  ) {
    const { tenantId, userId } = ctx;
    const defaultCurrency = await this.settingsService.getDefaultCurrencyCode(
      ctx.tenantId,
    );
    const { amountMinor: amountAmount, currencyCode: amountCurrencyCode } =
      applyDefaultCurrency(input.amount, defaultCurrency);

    if (input.source === CustomerTransactionSource.Payroll && !input.walletId) {
      throw new BadRequestException(
        'Для выдачи зарплаты обязателен выбор счёта',
      );
    }

    if (input.walletId) {
      const wallet = await this.walletService.findOne(ctx, input.walletId);
      if (!wallet) throw new NotFoundException('Счёт не найден');
      const isPayroll = input.source === CustomerTransactionSource.Payroll;
      const ctSource = isPayroll
        ? CustomerTransactionSource.Payroll
        : CustomerTransactionSource.Manual;
      const wtSource = isPayroll
        ? WalletTransactionSource.Payroll
        : WalletTransactionSource.OperandManual;
      return this.prisma.$transaction(async (tx) => {
        const ct = await tx.customerTransaction.create({
          data: {
            operandId: input.operandId,
            source: ctSource,
            sourceId: '00000000-0000-0000-0000-000000000000',
            description: input.description ?? null,
            amountAmount,
            amountCurrencyCode,
            tenantId,
            createdBy: userId,
          },
        });
        const wt = await this.walletTransactionService.createWithinTransaction(
          tx,
          {
            walletId: input.walletId!,
            source: wtSource,
            sourceId: ct.id,
            amount: {
              amountMinor: amountAmount,
              currencyCode: amountCurrencyCode,
            },
            description: input.description ?? null,
          },
          tenantId,
          userId,
        );
        await tx.customerTransaction.update({
          where: { id: ct.id },
          data: { sourceId: wt.id },
        });
        return tx.customerTransaction.findUniqueOrThrow({
          where: { id: ct.id },
        });
      });
    }

    const source =
      input.source === CustomerTransactionSource.Penalty
        ? CustomerTransactionSource.Penalty
        : CustomerTransactionSource.ManualWithoutWallet;
    return this.prisma.customerTransaction.create({
      data: {
        operandId: input.operandId,
        source,
        sourceId: userId,
        description: input.description ?? null,
        amountAmount,
        amountCurrencyCode,
        tenantId,
        createdBy: userId,
      },
    });
  }
}

function monthsInRange(from: Date, to: Date, tz: string): Date[] {
  const start = toZonedParts(from, tz);
  const end = toZonedParts(to, tz);
  const months: Date[] = [];
  let year = start.year;
  let month = start.month;
  while (year < end.year || (year === end.year && month <= end.month)) {
    months.push(zonedToUtc(year, month, 1, 0, 0, 0, tz));
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }
  return months;
}
