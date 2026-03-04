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
import { CustomerTransactionSource } from './enums/customer-transaction-source.enum';
import { SettingsService } from 'src/modules/settings/settings.service';
import { applyDefaultCurrency } from 'src/common/money';
import type { AuthContext } from 'src/common/user-id.store';

const DEFAULT_TAKE = 25;
const DEFAULT_SKIP = 0;

const ORDER_SOURCES = [
  CustomerTransactionSource.OrderPrepay,
  CustomerTransactionSource.OrderDebit,
  CustomerTransactionSource.OrderPayment,
  CustomerTransactionSource.OrderPrepayRefund,
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
    const defaultCurrency = await this.settingsService.getDefaultCurrencyCode();
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
    const defaultCurrency = await this.settingsService.getDefaultCurrencyCode();
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

  /** Проводки по заказу (OrderPrepay, OrderDebit, OrderPayment, OrderPrepayRefund; sourceId = orderId). */
  async findByOrderId(ctx: AuthContext, orderId: string) {
    return this.prisma.customerTransaction.findMany({
      where: {
        tenantId: ctx.tenantId,
        sourceId: orderId,
        source: { in: ORDER_SOURCES },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getBalance(ctx: AuthContext, operandId: string): Promise<bigint> {
    const result = await this.prisma.customerTransaction.aggregate({
      where: { operandId, tenantId: ctx.tenantId },
      _sum: { amountAmount: true },
    });
    return result._sum.amountAmount ?? BigInt(0);
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
    if (
      source === CustomerTransactionSource.Manual ||
      source === CustomerTransactionSource.Payroll
    ) {
      return this.displayContextService.getWalletNameByWalletTransactionId(
        ctx,
        sourceId,
      );
    }
    if (source === CustomerTransactionSource.ManualWithoutWallet) {
      return 'Ручная проводка (без счёта)';
    }
    if (source === CustomerTransactionSource.Penalty) {
      return '';
    }
    return '';
  }

  async createManualTransaction(
    ctx: AuthContext,
    input: CreateManualCustomerTransactionInput,
  ) {
    const { tenantId, userId } = ctx;
    const defaultCurrency = await this.settingsService.getDefaultCurrencyCode();
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
