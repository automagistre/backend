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
import { WarrantyPayer } from 'src/modules/order/enums/warranty-payer.enum';

const DEFAULT_TAKE = 25;
const DEFAULT_SKIP = 0;

/** Срез подрядной работы для синхронизации проводки оплаты подрядчику. */
export interface ContractorPayoutSource {
  /** order_item_service.id (= order_item.id) */
  serviceId: string;
  orderId: string;
  serviceName: string;
  kind: string;
  executorKind: string | null;
  executorId: string | null;
  costAmount: bigint | null;
  costCurrencyCode: string | null;
  costWalletId: string | null;
  /** Гарантийная работа по вине исполнителя (EXECUTOR) — подрядчик не получает оплату. */
  warranty?: boolean;
  warrantyPayer?: string | null;
}

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
   * Синхронизация проводки оплаты подрядчику (source=ContractorPayout, sourceId=serviceId)
   * с текущим состоянием подрядной работы. Вызывать внутри той же транзакции, что и
   * изменение работы. Проводка мутабельна только системой: создаётся при появлении
   * себестоимости, обновляется при её изменении, удаляется при обнулении/смене вида.
   * Каждая мутация фиксируется в аудите заказа.
   */
  async syncContractorPayout(
    tx: Prisma.TransactionClient,
    ctx: AuthContext,
    source: ContractorPayoutSource,
  ): Promise<void> {
    const existing = await tx.walletTransaction.findFirst({
      where: {
        source: WalletTransactionSource.ContractorPayout,
        sourceId: source.serviceId,
        tenantId: ctx.tenantId,
      },
    });

    // Гарантия по вине подрядчика (EXECUTOR) — организация не платит: удерживать
    // проводку смысла нет, кост подрядчика не оплачивается. warrantyPayer=ORGANIZATION
    // (или отсутствие гарантии) — оплата подрядчику идёт как обычно.
    const isExecutorWarranty =
      source.warranty === true &&
      source.warrantyPayer === WarrantyPayer.EXECUTOR;

    const shouldExist =
      source.kind === 'CONTRACTOR' &&
      source.costAmount != null &&
      source.costAmount > 0n &&
      source.costWalletId != null &&
      !isExecutorWarranty;

    if (!shouldExist && !existing) return;

    const displayName = await this.resolveContractorDisplay(source);

    if (!shouldExist && existing) {
      await tx.walletTransaction.delete({ where: { id: existing.id } });
      await this.auditContractorPayout(tx, ctx, source.orderId, existing.id, {
        action: AuditAction.DELETE,
        oldAmount: {
          amountMinor: existing.amountAmount ?? 0n,
          currencyCode: existing.amountCurrencyCode ?? '',
        },
        newAmount: null,
        displayName,
      });
      return;
    }

    const currencyCode =
      source.costCurrencyCode ??
      (await this.settingsService.getDefaultCurrencyCode());
    // Оплата подрядчику — расход: сумма в проводке отрицательная.
    const amountMinor = -source.costAmount!;
    const description = `Оплата подрядчику: ${source.serviceName}`;

    if (!existing) {
      const created = await tx.walletTransaction.create({
        data: {
          walletId: source.costWalletId!,
          source: WalletTransactionSource.ContractorPayout,
          sourceId: source.serviceId,
          description,
          amountAmount: amountMinor,
          amountCurrencyCode: currencyCode,
          tenantId: ctx.tenantId,
          createdBy: ctx.userId,
        },
      });
      await this.auditContractorPayout(tx, ctx, source.orderId, created.id, {
        action: AuditAction.CREATE,
        oldAmount: null,
        newAmount: { amountMinor, currencyCode },
        displayName,
      });
      return;
    }

    const unchanged =
      existing.walletId === source.costWalletId &&
      (existing.amountAmount ?? 0n) === amountMinor &&
      existing.amountCurrencyCode === currencyCode;
    if (unchanged) return;

    await tx.walletTransaction.update({
      where: { id: existing.id },
      data: {
        walletId: source.costWalletId!,
        description,
        amountAmount: amountMinor,
        amountCurrencyCode: currencyCode,
      },
    });
    await this.auditContractorPayout(tx, ctx, source.orderId, existing.id, {
      action: AuditAction.UPDATE,
      oldAmount: {
        amountMinor: existing.amountAmount ?? 0n,
        currencyCode: existing.amountCurrencyCode ?? '',
      },
      newAmount: { amountMinor, currencyCode },
      displayName,
    });
  }

  /**
   * Удаление проводок оплаты подрядчику при удалении работ (в т.ч. каскадном).
   * Вызывать внутри транзакции удаления позиций заказа.
   */
  async removeContractorPayouts(
    tx: Prisma.TransactionClient,
    ctx: AuthContext,
    orderId: string,
    serviceIds: string[],
  ): Promise<void> {
    if (serviceIds.length === 0) return;
    const transactions = await tx.walletTransaction.findMany({
      where: {
        source: WalletTransactionSource.ContractorPayout,
        sourceId: { in: serviceIds },
        tenantId: ctx.tenantId,
      },
    });
    for (const txn of transactions) {
      await tx.walletTransaction.delete({ where: { id: txn.id } });
      await this.auditContractorPayout(tx, ctx, orderId, txn.id, {
        action: AuditAction.DELETE,
        oldAmount: {
          amountMinor: txn.amountAmount ?? 0n,
          currencyCode: txn.amountCurrencyCode ?? '',
        },
        newAmount: null,
        displayName: txn.description ?? null,
      });
    }
  }

  private async resolveContractorDisplay(
    source: ContractorPayoutSource,
  ): Promise<string | null> {
    const contractor =
      source.executorKind && source.executorId
        ? await this.displayContextService.getPartyDisplay(
            source.executorKind,
            source.executorId,
          )
        : null;
    return contractor
      ? `Оплата подрядчику: ${contractor}`
      : `Оплата подрядчику: ${source.serviceName}`;
  }

  private async auditContractorPayout(
    tx: Prisma.TransactionClient,
    ctx: AuthContext,
    orderId: string,
    transactionId: string,
    params: {
      action: AuditAction;
      oldAmount: Money | null;
      newAmount: Money | null;
      displayName: string | null;
    },
  ): Promise<void> {
    const toJson = (m: Money | null) =>
      m
        ? { amountMinor: String(m.amountMinor), currencyCode: m.currencyCode }
        : null;
    await this.auditLog.record(tx, ctx, {
      rootEntityType: AuditEntityType.ORDER,
      rootEntityId: orderId,
      entityType: AuditEntityType.WALLET_TRANSACTION,
      entityId: transactionId,
      action: params.action,
      changes: [
        {
          field: 'amount',
          oldValue: toJson(params.oldAmount),
          newValue: toJson(params.newAmount),
        },
      ],
      entityDisplayName: params.displayName,
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
      case WalletTransactionSource.ContractorPayout: {
        // source_id — order_item_service.id; контекст — заказ этой работы.
        const item = await this.prisma.orderItem.findUnique({
          where: { id: sourceId },
          select: { orderId: true },
        });
        if (!item?.orderId) return '';
        return this.displayContextService.getOrderContext(ctx, item.orderId);
      }
      case WalletTransactionSource.Legacy:
      case WalletTransactionSource.Initial:
      default:
        return '';
    }
  }
}
