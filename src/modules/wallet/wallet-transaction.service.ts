import { Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Prisma } from 'src/generated/prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateWalletTransactionInput } from './inputs/create-wallet-transaction.input';
import { WalletService } from './wallet.service';
import { DisplayContextService } from 'src/modules/display-context/display-context.service';
import { WalletTransactionSource } from './enums/wallet-transaction-source.enum';
import { applyDefaultCurrency, type Money } from 'src/common/money';
import { SettingsService } from 'src/modules/settings/settings.service';
import type { AuthContext } from 'src/common/user-id.store';
import { AuditLogService } from 'src/modules/audit-log/audit-log.service';
import {
  AuditAction,
  AuditEntityType,
} from 'src/modules/audit-log/enums/audit.enums';

const DEFAULT_TAKE = 25;
const DEFAULT_SKIP = 0;

/**
 * Действие аудита по проводке заказа. OrderPrepay и OrderPrepayRefund имеют
 * одинаковое числовое значение (=1, совместимость со старой CRM), различаем по знаку суммы.
 */
function resolveOrderWalletAction(
  source: number,
  amountAmount: bigint,
): AuditAction | null {
  if (source === WalletTransactionSource.OrderDebit) return AuditAction.DEBIT;
  if (source === WalletTransactionSource.OrderPrepay) {
    return amountAmount < 0n ? AuditAction.REFUND : AuditAction.PREPAY;
  }
  return null;
}

@Injectable()
export class WalletTransactionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly walletService: WalletService,
    private readonly displayContextService: DisplayContextService,
    private readonly settingsService: SettingsService,
    private readonly auditLog: AuditLogService,
  ) {}

  /** Лог движения по кошельку в журнал заказа (если источник связан с заказом). */
  private async auditOrderWalletMovement(
    client: Prisma.TransactionClient,
    actor: { userId: string; tenantId: string },
    txn: { id: string; source: number; sourceId: string },
    amount: Money,
  ): Promise<void> {
    const action = resolveOrderWalletAction(txn.source, amount.amountMinor);
    if (!action) return;
    await this.auditLog.record(client, actor, {
      rootEntityType: AuditEntityType.ORDER,
      rootEntityId: txn.sourceId,
      entityType: AuditEntityType.WALLET_TRANSACTION,
      entityId: txn.id,
      action,
      changes: [
        {
          field: 'amount',
          oldValue: null,
          newValue: {
            amountMinor: String(amount.amountMinor),
            currencyCode: amount.currencyCode,
          },
        },
      ],
      entityDisplayName: await this.resolveOrderCounterparty(txn.sourceId),
    });
  }

  /** Контрагент проводки заказа: ФИО заказчика или название организации. */
  private async resolveOrderCounterparty(
    orderId: string,
  ): Promise<string | null> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: { customerId: true },
    });
    if (!order?.customerId) return null;
    return this.displayContextService.getOperandDisplayName(order.customerId);
  }

  private async normalizeAmount(
    input: CreateWalletTransactionInput,
  ): Promise<Money> {
    const defaultCurrency = await this.settingsService.getDefaultCurrencyCode();
    return applyDefaultCurrency(input.amount, defaultCurrency);
  }

  async findOne(ctx: AuthContext, walletId: string) {
    return this.walletService.findOne(ctx, walletId);
  }

  async create(ctx: AuthContext, data: CreateWalletTransactionInput) {
    const { tenantId, userId } = ctx;
    const wallet = await this.findOne(ctx, data.walletId);
    if (!wallet) throw new NotFoundException('Счёт не найден');
    const amount = await this.normalizeAmount(data);
    const created = await this.prisma.walletTransaction.create({
      data: {
        walletId: data.walletId,
        source: data.source,
        sourceId: data.sourceId ?? randomUUID(),
        description: data.description ?? null,
        amountAmount: amount.amountMinor,
        amountCurrencyCode: amount.currencyCode,
        tenantId,
        createdBy: userId,
      },
      include: { wallet: true },
    });
    await this.auditOrderWalletMovement(
      this.prisma,
      { userId, tenantId },
      { id: created.id, source: created.source, sourceId: created.sourceId },
      amount,
    );
    return created;
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
    const amount = await this.normalizeAmount(data);
    const created = await tx.walletTransaction.create({
      data: {
        walletId: data.walletId,
        source: data.source,
        sourceId: data.sourceId ?? randomUUID(),
        description: data.description ?? null,
        amountAmount: amount.amountMinor,
        amountCurrencyCode: amount.currencyCode,
        tenantId,
        createdBy,
      },
      include: { wallet: true },
    });
    await this.auditOrderWalletMovement(
      tx,
      { userId: createdBy, tenantId },
      { id: created.id, source: created.source, sourceId: created.sourceId },
      amount,
    );
    return created;
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

  async findOneTransaction(ctx: AuthContext, id: string) {
    return this.prisma.walletTransaction.findFirst({
      where: { id, tenantId: ctx.tenantId },
      include: { wallet: true },
    });
  }

  /**
   * Контекстная строка для отображения (номер заказа, ФИО и т.д.).
   * Фронт склеивает с меткой типа источника.
   */
  async getSourceDisplay(
    ctx: AuthContext,
    source: number,
    sourceId: string,
  ): Promise<string> {
    switch (source as WalletTransactionSource) {
      case WalletTransactionSource.OrderPrepay:
      case WalletTransactionSource.OrderDebit:
      case WalletTransactionSource.OrderPrepayRefund:
        return this.displayContextService.getOrderContext(ctx, sourceId);
      case WalletTransactionSource.Payroll: {
        // source_id указывает на customer_transaction.id; получатель ЗП —
        // operand_id связанной проводки по клиенту (person сотрудника).
        const ct = await this.prisma.customerTransaction.findFirst({
          where: { id: sourceId, tenantId: ctx.tenantId },
          select: { operandId: true },
        });
        if (!ct) return '';
        return (
          (await this.displayContextService.getOperandDisplayName(
            ct.operandId,
          )) ?? ''
        );
      }
      case WalletTransactionSource.OperandManual:
        return this.displayContextService.getPersonDisplay(sourceId);
      case WalletTransactionSource.IncomePayment:
        return '';
      case WalletTransactionSource.Expense:
        return this.displayContextService.getExpenseName(ctx, sourceId);
      case WalletTransactionSource.ManualIncome:
        return '';
      case WalletTransactionSource.Legacy:
      case WalletTransactionSource.Initial:
      default:
        return '';
    }
  }
}
