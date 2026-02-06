import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from 'src/generated/prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateWalletTransactionInput } from './inputs/create-wallet-transaction.input';
import { TenantService } from 'src/common/services/tenant.service';
import { WalletService } from './wallet.service';
import { DisplayContextService } from 'src/modules/display-context/display-context.service';
import { WalletTransactionSource } from './enums/wallet-transaction-source.enum';
import { applyDefaultCurrency } from 'src/common/money';
import { SettingsService } from 'src/modules/settings/settings.service';

const DEFAULT_TAKE = 25;
const DEFAULT_SKIP = 0;

@Injectable()
export class WalletTransactionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantService: TenantService,
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

  async create(data: CreateWalletTransactionInput) {
    const tenantId = await this.tenantService.getTenantId();
    const wallet = await this.walletService.findOne(data.walletId);
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
      },
      include: { wallet: true },
    });
  }

  /**
   * Создание проводки внутри переданной транзакции (для атомарности с order_payment и т.д.).
   * Вызывающий обязан проверить существование кошелька до старта транзакции.
   */
  async createWithinTransaction(
    tx: Prisma.TransactionClient,
    data: CreateWalletTransactionInput,
    tenantId: string,
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
      },
      include: { wallet: true },
    });
  }

  async findMany({
    take = DEFAULT_TAKE,
    skip = DEFAULT_SKIP,
    walletId,
  }: {
    take?: number;
    skip?: number;
    walletId?: string;
  }) {
    const tenantId = await this.tenantService.getTenantId();
    const where = {
      tenantId,
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
  async findPrepaymentsByOrderId(orderId: string) {
    const tenantId = await this.tenantService.getTenantId();
    return this.prisma.walletTransaction.findMany({
      where: {
        tenantId,
        source: WalletTransactionSource.OrderPrepay,
        sourceId: orderId,
      },
      orderBy: { createdAt: 'desc' },
      include: { wallet: true },
    });
  }

  async findOne(id: string) {
    const tenantId = await this.tenantService.getTenantId();
    return this.prisma.walletTransaction.findFirst({
      where: { id, tenantId },
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
        return '';
      case WalletTransactionSource.Legacy:
      case WalletTransactionSource.Initial:
      default:
        return '';
    }
  }
}
