import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from 'src/generated/prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { TenantService } from 'src/common/services/tenant.service';
import { WalletService } from 'src/modules/wallet/wallet.service';
import { WalletTransactionService } from 'src/modules/wallet/wallet-transaction.service';
import { WalletTransactionSource } from 'src/modules/wallet/enums/wallet-transaction-source.enum';
import { DisplayContextService } from 'src/modules/display-context/display-context.service';
import { CreateCustomerTransactionInput } from './inputs/create-customer-transaction.input';
import { CreateManualCustomerTransactionInput } from './inputs/create-manual-customer-transaction.input';
import { CustomerTransactionSource } from './enums/customer-transaction-source.enum';
import { SettingsService } from 'src/modules/settings/settings.service';
import { applyDefaultCurrency } from 'src/common/money';

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
    private readonly tenantService: TenantService,
    private readonly walletService: WalletService,
    private readonly walletTransactionService: WalletTransactionService,
    private readonly displayContextService: DisplayContextService,
    private readonly settingsService: SettingsService,
  ) {}

  /**
   * Создание проводки внутри переданной транзакции (для CloseOrder).
   * Не вызывать при createPrepay/refundPrepay — проводки по клиенту переносятся только при закрытии заказа.
   */
  async createWithinTransaction(
    tx: Prisma.TransactionClient,
    data: CreateCustomerTransactionInput,
    tenantId: string,
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
      },
    });
  }

  /**
   * Создание одной проводки без внешней транзакции (для фонового job, напр. начисление зарплаты по заказу).
   */
  async create(data: CreateCustomerTransactionInput, tenantId: string) {
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
      },
    });
  }

  async findMany({
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
  }) {
    const tenantId = await this.tenantService.getTenantId();
    const where: Prisma.CustomerTransactionWhereInput = {
      tenantId,
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
  async findByOrderId(orderId: string) {
    const tenantId = await this.tenantService.getTenantId();
    return this.prisma.customerTransaction.findMany({
      where: {
        tenantId,
        sourceId: orderId,
        source: { in: ORDER_SOURCES },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getBalance(operandId: string): Promise<bigint> {
    const tenantId = await this.tenantService.getTenantId();
    const result = await this.prisma.customerTransaction.aggregate({
      where: { operandId, tenantId },
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
  async getSourceDisplay(source: number, sourceId: string): Promise<string> {
    if (source === CustomerTransactionSource.OrderSalary) {
      return this.displayContextService.getOrderContextByOrderIdForSalary(sourceId);
    }
    if (ORDER_SOURCES.includes(source as CustomerTransactionSource)) {
      return this.displayContextService.getOrderContext(sourceId);
    }
    if (source === CustomerTransactionSource.Manual) {
      return this.displayContextService.getWalletNameByWalletTransactionId(
        sourceId,
      );
    }
    if (source === CustomerTransactionSource.ManualWithoutWallet) {
      return 'Ручная проводка (без счёта)';
    }
    return '';
  }

  async createManualTransaction(input: CreateManualCustomerTransactionInput) {
    const tenantId = await this.tenantService.getTenantId();
    const defaultCurrency = await this.settingsService.getDefaultCurrencyCode();
    const { amountMinor: amountAmount, currencyCode: amountCurrencyCode } =
      applyDefaultCurrency(input.amount, defaultCurrency);

    if (input.walletId) {
      const wallet = await this.walletService.findOne(input.walletId);
      if (!wallet) throw new NotFoundException('Счёт не найден');
      return this.prisma.$transaction(async (tx) => {
        const ct = await tx.customerTransaction.create({
          data: {
            operandId: input.operandId,
            source: CustomerTransactionSource.Manual,
            sourceId: '00000000-0000-0000-0000-000000000000', // обновим после создания wallet_transaction
            description: input.description ?? null,
            amountAmount,
            amountCurrencyCode,
            tenantId,
          },
        });
        const wt = await this.walletTransactionService.createWithinTransaction(
          tx,
          {
            walletId: input.walletId!,
            source: WalletTransactionSource.OperandManual,
            sourceId: ct.id,
            amount: { amountMinor: amountAmount, currencyCode: amountCurrencyCode },
            description: input.description ?? null,
          },
          tenantId,
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

    // sourceId для ManualWithoutWallet — в CRM пишется userId; пока placeholder
    const manualWithoutWalletSourceId =
      '24602e10-629b-4f23-8d8b-1cca08fb8a84';
    return this.prisma.customerTransaction.create({
      data: {
        operandId: input.operandId,
        source: CustomerTransactionSource.ManualWithoutWallet,
        sourceId: manualWithoutWalletSourceId,
        description: input.description ?? null,
        amountAmount,
        amountCurrencyCode,
        tenantId,
      },
    });
  }
}
