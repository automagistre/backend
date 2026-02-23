import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from 'src/generated/prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateWalletTransactionInput } from './inputs/create-wallet-transaction.input';
import { WalletService } from './wallet.service';
import { DisplayContextService } from 'src/modules/display-context/display-context.service';
import { WalletTransactionSource } from './enums/wallet-transaction-source.enum';
import { applyDefaultCurrency } from 'src/common/money';
import { SettingsService } from 'src/modules/settings/settings.service';
import type { AuthContext } from 'src/common/user-id.store';

const DEFAULT_TAKE = 25;
const DEFAULT_SKIP = 0;

@Injectable()
export class WalletTransactionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly walletService: WalletService,
    private readonly displayContextService: DisplayContextService,
    private readonly settingsService: SettingsService,
  ) {}

  private async normalizeAmountFields(
    input: CreateWalletTransactionInput,
  ): Promise<{ amountAmount: bigint; amountCurrencyCode: string }> {
    const defaultCurrency = await this.settingsService.getDefaultCurrencyCode();
    const m = applyDefaultCurrency(input.amount, defaultCurrency);
    return { amountAmount: m.amountMinor, amountCurrencyCode: m.currencyCode };
  }

  async create(ctx: AuthContext, data: CreateWalletTransactionInput) {
    const { tenantId, userId } = ctx;
    const wallet = await this.walletService.findOne(ctx, data.walletId);
    if (!wallet) throw new NotFoundException('Счёт не найден');
    const { amountAmount, amountCurrencyCode } =
      await this.normalizeAmountFields(data);
    return this.prisma.walletTransaction.create({
      data: {
        walletId: data.walletId,
        source: data.source,
        sourceId: data.sourceId,
        description: data.description ?? null,
        amountAmount,
        amountCurrencyCode,
        tenantId,
        createdBy: userId,
      },
      include: { wallet: true },
    });
  }

  /**
   * Создание проводки внутри переданной транзакции (для атомарности с order_payment и т.д.).
   * Вызывающий обязан проверить существование кошелька до старта транзакции.
   * @param tx - Prisma transaction client
   * @param data - данные проводки
   * @param tenantId - ID тенанта (из ctx.tenantId)
   * @param createdBy - ID пользователя (из ctx.userId)
   */
  async createWithinTransaction(
    tx: Prisma.TransactionClient,
    data: CreateWalletTransactionInput,
    tenantId: string,
    createdBy: string,
  ) {
    const { amountAmount, amountCurrencyCode } =
      await this.normalizeAmountFields(data);
    return tx.walletTransaction.create({
      data: {
        walletId: data.walletId,
        source: data.source,
        sourceId: data.sourceId,
        description: data.description ?? null,
        amountAmount,
        amountCurrencyCode,
        tenantId,
        createdBy,
      },
      include: { wallet: true },
    });
  }

  async findMany(
    ctx: AuthContext,
    {
      take = DEFAULT_TAKE,
      skip = DEFAULT_SKIP,
      walletId,
    }: {
      take?: number;
      skip?: number;
      walletId?: string;
    },
  ) {
    const where = {
      tenantId: ctx.tenantId,
      ...(walletId ? { walletId } : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.walletTransaction.findMany({
        where,
        take: +take,
        skip: +skip,
        orderBy: { createdAt: 'desc' },
        include: { wallet: true },
      }),
      this.prisma.walletTransaction.count({ where }),
    ]);
    return { items, total };
  }

  /** Проводки предоплаты по заказу (source = OrderPrepay, sourceId = orderId). */
  async findPrepaymentsByOrderId(ctx: AuthContext, orderId: string) {
    return this.prisma.walletTransaction.findMany({
      where: {
        tenantId: ctx.tenantId,
        source: WalletTransactionSource.OrderPrepay,
        sourceId: orderId,
      },
      orderBy: { createdAt: 'desc' },
      include: { wallet: true },
    });
  }

  /** Все проводки по заказу (OrderPrepay, OrderDebit, OrderPrepayRefund). */
  async findByOrderId(ctx: AuthContext, orderId: string) {
    return this.prisma.walletTransaction.findMany({
      where: {
        tenantId: ctx.tenantId,
        sourceId: orderId,
        source: {
          in: [
            WalletTransactionSource.OrderPrepay,
            WalletTransactionSource.OrderDebit,
            WalletTransactionSource.OrderPrepayRefund,
          ],
        },
      },
      orderBy: { createdAt: 'desc' },
      include: { wallet: true },
    });
  }

  async findOne(ctx: AuthContext, id: string) {
    return this.prisma.walletTransaction.findFirst({
      where: { id, tenantId: ctx.tenantId },
      include: { wallet: true },
    });
  }

  /**
   * Контекстная строка для отображения (номер заказа, ФИО и т.д.).
   * Фронт склеивает с меткой типа источника.
   */
  async getSourceDisplay(source: number, sourceId: string): Promise<string> {
    switch (source as WalletTransactionSource) {
      case WalletTransactionSource.OrderPrepay:
      case WalletTransactionSource.OrderDebit:
      case WalletTransactionSource.OrderPrepayRefund:
        return this.displayContextService.getOrderContext(sourceId);
      case WalletTransactionSource.Payroll:
        // source_id — id записи customer_transaction
        return '';
      case WalletTransactionSource.OperandManual:
        return this.displayContextService.getPersonDisplay(sourceId);
      case WalletTransactionSource.IncomePayment:
        return '';
      case WalletTransactionSource.Expense:
        return this.displayContextService.getExpenseName(sourceId);
      case WalletTransactionSource.Legacy:
      case WalletTransactionSource.Initial:
      default:
        return '';
    }
  }
}
