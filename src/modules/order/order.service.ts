import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { OrderModel } from './models/order.model';
import { OrderStatus } from './enums/order-status.enum';
import { UpdateOrderInput } from './inputs/update-order.input';
import { CreateOrderInput } from './inputs/create-order.input';
import { CreateOrderPrepayInput } from './inputs/create-order-prepay.input';
import { RefundOrderPrepayInput } from './inputs/refund-order-prepay.input';
import { CloseOrderInput } from './inputs/close-order.input';
import { CancelOrderInput } from './inputs/cancel-order.input';
import { Prisma } from 'src/generated/prisma/client';
import { WalletTransactionService } from 'src/modules/wallet/wallet-transaction.service';
import { WalletTransactionSource } from 'src/modules/wallet/enums/wallet-transaction-source.enum';
import { SalaryService } from 'src/modules/salary/salary.service';
import { CustomerTransactionService } from 'src/modules/customer-transaction/customer-transaction.service';
import { CustomerTransactionSource } from 'src/modules/customer-transaction/enums/customer-transaction-source.enum';
import { SettingsService } from 'src/modules/settings/settings.service';
import { WarehouseService } from 'src/modules/warehouse/warehouse.service';
import { OrganizationService } from 'src/modules/organization/organization.service';
import { TasksService } from 'src/modules/tasks/tasks.service';
import { NoteType } from 'src/modules/note/enums/note-type.enum';
import { RecommendationWorkMigrationService } from 'src/modules/recommendation-migration/recommendation-work-migration.service';
import { applyDefaultCurrency } from 'src/common/money';
import type { AuthContext } from 'src/common/user-id.store';
import { v6 as uuidv6 } from 'uuid';
import { getOrderCancelReasonLabel } from './constants/order-cancel-reasons';

const DELETE_COOLING_HOURS = 3;
/** Совместимость со старой CRM: DiscriminatorMap OrderClose — 1 = OrderDeal, 2 = OrderCancel */
const ORDER_CLOSE_TYPE_DEAL = '1';
const ORDER_CLOSE_TYPE_CANCEL = '2';

@Injectable()
export class OrderService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly walletTransactionService: WalletTransactionService,
    private readonly salaryService: SalaryService,
    private readonly customerTransactionService: CustomerTransactionService,
    private readonly settingsService: SettingsService,
    private readonly warehouseService: WarehouseService,
    private readonly organizationService: OrganizationService,
    private readonly tasksService: TasksService,
    @Inject(forwardRef(() => RecommendationWorkMigrationService))
    private readonly recommendationWorkMigrationService: RecommendationWorkMigrationService,
  ) {}

  async findOne(ctx: AuthContext, id: string): Promise<OrderModel | null> {
    return this.prisma.order.findFirst({
      where: { id, tenantId: ctx.tenantId },
    }) as Promise<OrderModel | null>;
  }

  /**
   * Создание предоплаты по заказу: order_payment + wallet_transaction в одной транзакции.
   * Возвращает созданную проводку по кошельку (для списка предоплат).
   */
  async createPrepay(ctx: AuthContext, input: CreateOrderPrepayInput) {
    const { tenantId, userId } = ctx;
    await this.validateOrderEditable(ctx, input.orderId);
    const wallet = await this.prisma.wallet.findFirst({
      where: { id: input.walletId, tenantId },
    });
    if (!wallet) throw new NotFoundException('Счёт не найден');
    const defaultCurrency = await this.settingsService.getDefaultCurrencyCode();
    const { amountMinor, currencyCode } = applyDefaultCurrency(
      input.amount,
      defaultCurrency,
    );
    return this.prisma.$transaction(async (tx) => {
      await tx.orderPayment.create({
        data: {
          orderId: input.orderId,
          tenantId,
          amountAmount: amountMinor,
          amountCurrencyCode: currencyCode,
          description: input.description ?? null,
          createdBy: userId,
        },
      });
      return this.walletTransactionService.createWithinTransaction(
        tx,
        {
          walletId: input.walletId,
          source: WalletTransactionSource.OrderPrepay,
          sourceId: input.orderId,
          amount: { amountMinor, currencyCode },
          description: input.description ?? null,
        },
        tenantId,
        userId,
      );
    });
  }

  /**
   * Возврат предоплаты: создаём order_payment с отрицательной суммой + проводку списания по кошельку.
   * Сумма возврата не больше текущей суммы предоплат по заказу.
   */
  async refundPrepay(ctx: AuthContext, input: RefundOrderPrepayInput) {
    const { tenantId, userId } = ctx;
    await this.validateOrderEditable(ctx, input.orderId);
    const wallet = await this.prisma.wallet.findFirst({
      where: { id: input.walletId, tenantId },
    });
    if (!wallet) throw new NotFoundException('Счёт не найден');
    const payments = await this.prisma.orderPayment.findMany({
      where: { orderId: input.orderId, tenantId },
      select: { amountAmount: true },
    });
    const prepaymentTotal = payments.reduce(
      (acc, p) => acc + (p.amountAmount ?? 0n),
      0n,
    );
    const { amountMinor } = applyDefaultCurrency(
      input.amount,
      await this.settingsService.getDefaultCurrencyCode(),
    );
    const refundAmount = amountMinor > 0n ? amountMinor : -amountMinor;
    if (refundAmount > prepaymentTotal) {
      throw new BadRequestException(
        `Сумма возврата не может превышать сумму предоплат по заказу`,
      );
    }
    const defaultCurrency = await this.settingsService.getDefaultCurrencyCode();
    const { currencyCode } = applyDefaultCurrency(
      input.amount,
      defaultCurrency,
    );
    return this.prisma.$transaction(async (tx) => {
      await tx.orderPayment.create({
        data: {
          orderId: input.orderId,
          tenantId,
          amountAmount: -refundAmount,
          amountCurrencyCode: currencyCode,
          description: input.description ?? null,
          createdBy: userId,
        },
      });
      return this.walletTransactionService.createWithinTransaction(
        tx,
        {
          walletId: input.walletId,
          source: WalletTransactionSource.OrderPrepayRefund,
          sourceId: input.orderId,
          amount: { amountMinor: -refundAmount, currencyCode },
          description: input.description ?? null,
        },
        tenantId,
        userId,
      );
    });
  }

  /** Предоплаты по заказу из таблицы order_payment. */
  async findPaymentsByOrderId(ctx: AuthContext, orderId: string) {
    return this.prisma.orderPayment.findMany({
      where: { orderId, tenantId: ctx.tenantId },
      orderBy: [{ createdAt: 'asc' }],
    });
  }

  /**
   * Сумма заказа: услуги (priceAmount - discountAmount) + запчасти (priceAmount - discountAmount) * (quantity / 100).
   * Количество запчастей приходит в сотых долях (100 = 1 ед., 250 = 2.5 ед.), нормализуем до единиц делением на 100.
   */
  async getOrderTotal(ctx: AuthContext, orderId: string): Promise<bigint> {
    const items = await this.prisma.orderItem.findMany({
      where: { orderId, tenantId: ctx.tenantId },
      include: { service: true, part: true },
    });
    let total = 0n;
    for (const item of items) {
      if (item.service) {
        if (item.service.warranty) continue;
        const p = item.service.priceAmount ?? 0n;
        const d = item.service.discountAmount ?? 0n;
        total += p - d;
      }
      if (item.part) {
        if (item.part.warranty) continue;
        const p = item.part.priceAmount ?? 0n;
        const d = item.part.discountAmount ?? 0n;
        total += ((p - d) * BigInt(item.part.quantity)) / 100n;
      }
    }
    return total;
  }

  async getDisplayContext(ctx: AuthContext, orderId: string): Promise<string> {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, tenantId: ctx.tenantId },
      select: {
        number: true,
        customerId: true,
        customer: { select: { lastname: true, firstname: true } },
      },
    });
    if (!order) return '';
    const parts = [`№${order.number}`];
    if (order.customerId) {
      const personName =
        order.customer &&
        [order.customer.lastname, order.customer.firstname]
          .filter(Boolean)
          .join(' ');
      if (personName) {
        parts.push(personName);
      } else {
        const org = await this.prisma.organization.findUnique({
          where: { id: order.customerId },
          select: { name: true },
        });
        if (org?.name) parts.push(org.name);
      }
    }
    return parts.join(', ');
  }

  async findMany(
    ctx: AuthContext,
    {
      take,
      skip,
      search,
      status,
      customerId,
      carId,
    }: {
      take?: number;
      skip?: number;
      search?: string;
      status?: OrderStatus[];
      customerId?: string;
      carId?: string;
    },
  ): Promise<{ items: OrderModel[]; total: number }> {
    const orgIdsForSearch = await this.organizationService.findIdsBySearch(
      ctx,
      search ?? '',
    );
    const where = this.buildOrdersWhere(
      ctx.tenantId,
      search,
      status,
      undefined,
      customerId,
      carId,
      orgIdsForSearch,
    );
    const [items, total] = await this.prisma.$transaction([
      this.prisma.order.findMany({
        where,
        take,
        skip,
        orderBy: [{ number: 'desc' }],
      }),
      this.prisma.order.count({ where }),
    ]);

    return { items: items as OrderModel[], total };
  }

  async findActiveOrders(
    ctx: AuthContext,
    {
      search,
      status,
    }: {
      search?: string;
      status?: OrderStatus[];
    } = {},
  ): Promise<OrderModel[]> {
    const { start, end } = this.getBusinessDayRange();
    const { tenantId } = ctx;

    const closedTodayCondition: Prisma.OrderCloseWhereInput = {
      tenantId,
      OR: [
        {
          orderDeal: {
            is: {
              createdAt: { gte: start, lt: end },
            },
          },
        },
        {
          orderCancel: {
            is: {
              createdAt: { gte: start, lt: end },
            },
          },
        },
      ],
    };

    const activeWhere: Prisma.OrderWhereInput = {
      tenantId,
      OR: [
        { status: { notIn: [OrderStatus.CLOSED, OrderStatus.CANCELLED] } },
        {
          status: { in: [OrderStatus.CLOSED, OrderStatus.CANCELLED] },
          close: { is: closedTodayCondition },
        },
      ],
    };

    const orgIdsForSearch = await this.organizationService.findIdsBySearch(
      ctx,
      search ?? '',
    );
    const where = this.buildOrdersWhere(
      tenantId,
      search,
      status,
      activeWhere,
      undefined,
      undefined,
      orgIdsForSearch,
    );

    return this.prisma.order.findMany({
      where,
      orderBy: [{ number: 'desc' }],
    }) as Promise<OrderModel[]>;
  }

  private buildOrdersWhere(
    tenantId: string,
    search?: string,
    status?: OrderStatus[],
    baseWhere: Record<string, unknown> = { tenantId },
    customerId?: string,
    carId?: string,
    orgIdsForSearch: string[] = [],
  ): Record<string, unknown> {
    const and: Record<string, unknown>[] = [{ ...baseWhere }];
    if (customerId) {
      and.push({ customerId });
    }
    if (carId) {
      and.push({ carId });
    }
    if (status?.length) {
      and.push({ status: { in: status } });
    }
    if (search?.trim()) {
      const term = search.trim();
      const num = Number(term);
      const searchOr = [
        ...(Number.isInteger(num) ? [{ number: num }] : []),
        { car: { gosnomer: { contains: term, mode: 'insensitive' } } },
        {
          car: {
            vehicle: {
              manufacturer: { name: { contains: term, mode: 'insensitive' } },
            },
          },
        },
        {
          car: {
            vehicle: {
              manufacturer: {
                localizedName: { contains: term, mode: 'insensitive' },
              },
            },
          },
        },
        { car: { vehicle: { name: { contains: term, mode: 'insensitive' } } } },
        {
          car: {
            vehicle: { localizedName: { contains: term, mode: 'insensitive' } },
          },
        },
        { customer: { firstname: { contains: term, mode: 'insensitive' } } },
        { customer: { lastname: { contains: term, mode: 'insensitive' } } },
        { customer: { telephone: { contains: term, mode: 'insensitive' } } },
        ...(orgIdsForSearch.length > 0
          ? [{ customerId: { in: orgIdsForSearch } }]
          : []),
      ].filter(Boolean);
      if (searchOr.length) {
        and.push({ OR: searchOr });
      }
    }
    return and.length === 1 ? and[0] : { AND: and };
  }

  private async checkCanDelete(
    ctx: AuthContext,
    orderId: string,
  ): Promise<
    | { deletable: true }
    | { deletable: false; notFound?: boolean; message: string }
  > {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, tenantId: ctx.tenantId },
      select: {
        createdAt: true,
        close: { select: { id: true } },
        _count: { select: { items: true } },
      },
    });
    if (!order) {
      return {
        deletable: false,
        notFound: true,
        message: `Заказ с ID ${orderId} не найден`,
      };
    }
    if (order.close) {
      return { deletable: false, message: 'Нельзя удалить закрытый заказ' };
    }
    if (order._count.items > 0) {
      return {
        deletable: false,
        message: 'Нельзя удалить заказ с работами или запчастями',
      };
    }
    const createdAt = order.createdAt ?? new Date(0);
    const deadline = new Date(
      createdAt.getTime() + DELETE_COOLING_HOURS * 60 * 60 * 1000,
    );
    if (new Date() > deadline) {
      return {
        deletable: false,
        message: `Время для удаления истекло (${DELETE_COOLING_HOURS} ч с момента создания)`,
      };
    }
    return { deletable: true };
  }

  async canDeleteOrder(ctx: AuthContext, orderId: string): Promise<boolean> {
    const result = await this.checkCanDelete(ctx, orderId);
    return result.deletable;
  }

  async deleteOrder(ctx: AuthContext, orderId: string): Promise<boolean> {
    const result = await this.checkCanDelete(ctx, orderId);
    if (!result.deletable) {
      if (result.notFound) {
        throw new NotFoundException(result.message);
      }
      throw new BadRequestException(result.message);
    }
    await this.prisma.order.delete({ where: { id: orderId } });
    return true;
  }

  async getClosedAt(ctx: AuthContext, orderId: string): Promise<Date | null> {
    const close = await this.prisma.orderClose.findFirst({
      where: { orderId, tenantId: ctx.tenantId },
      include: {
        orderDeal: true,
        orderCancel: true,
      },
    });

    if (!close) {
      return null;
    }

    return close.orderDeal?.createdAt ?? close.orderCancel?.createdAt ?? null;
  }

  async getClosedBy(ctx: AuthContext, orderId: string): Promise<string | null> {
    const close = await this.prisma.orderClose.findFirst({
      where: { orderId, tenantId: ctx.tenantId },
      include: {
        orderDeal: true,
        orderCancel: true,
      },
    });

    if (!close) {
      return null;
    }

    return close.orderDeal?.createdBy ?? close.orderCancel?.createdBy ?? null;
  }

  async getScheduledAt(
    ctx: AuthContext,
    orderId: string,
  ): Promise<Date | null> {
    const link = await this.prisma.calendarEntryOrder.findFirst({
      where: {
        orderId,
        tenantId: ctx.tenantId,
        calendarEntry: {
          calendarEntryDeletion: null,
        },
      },
      orderBy: { id: 'desc' },
      select: { entryId: true },
    });
    if (!link) {
      return null;
    }
    const schedule = await this.prisma.calendarEntrySchedule.findFirst({
      where: { entryId: link.entryId, tenantId: ctx.tenantId },
      orderBy: { id: 'desc' },
      select: { date: true },
    });
    return schedule?.date ?? null;
  }

  private getBusinessDayRange(now: Date = new Date()): {
    start: Date;
    end: Date;
  } {
    const shifted = new Date(now);
    shifted.setHours(shifted.getHours() - 3);

    const start = new Date(shifted);
    start.setHours(3, 0, 0, 0);

    const end = new Date(start);
    end.setDate(start.getDate() + 1);

    return { start, end };
  }

  private buildCancelReasonText(
    reasonCode: string,
    reasonComment?: string | null,
  ): string {
    const reasonLabel = getOrderCancelReasonLabel(reasonCode);
    const comment = reasonComment?.trim();
    return comment
      ? `${reasonLabel}. ${comment}`
      : reasonLabel;
  }

  async create(ctx: AuthContext, input: CreateOrderInput): Promise<OrderModel> {
    const { tenantId, userId } = ctx;
    const entryId = input.entryId ?? undefined;
    if (!entryId) {
      const agg = await this.prisma.order.aggregate({
        where: { tenantId },
        _max: { number: true },
      });
      const nextNumber = (agg._max?.number ?? 0) + 1;
      return this.prisma.order.create({
        data: {
          tenantId,
          number: nextNumber,
          status: OrderStatus.WORKING,
          customerId: input.customerId ?? null,
          carId: input.carId ?? null,
          workerId: input.workerId ?? null,
          createdBy: userId,
        },
      }) as Promise<OrderModel>;
    }

    return this.prisma.$transaction(async (tx) => {
      const entry = await tx.calendarEntry.findFirst({
        where: {
          id: entryId,
          tenantId,
          calendarEntryDeletion: null,
        },
        select: { id: true },
      });
      if (!entry) {
        throw new NotFoundException(
          `Запись календаря с ID ${entryId} не найдена`,
        );
      }

      // Блокируем строку записи, чтобы параллельные запросы не создали дубль заказа.
      await tx.$queryRaw(
        Prisma.sql`SELECT id FROM calendar_entry WHERE id = ${entryId} FOR UPDATE`,
      );

      const existingLink = await tx.calendarEntryOrder.findFirst({
        where: { entryId, tenantId },
        orderBy: { id: 'desc' },
        select: { orderId: true },
      });
      if (existingLink) {
        throw new BadRequestException('Для этой записи уже создан заказ');
      }

      const agg = await tx.order.aggregate({
        where: { tenantId },
        _max: { number: true },
      });
      const nextNumber = (agg._max?.number ?? 0) + 1;
      const order = await tx.order.create({
        data: {
          tenantId,
          number: nextNumber,
          status: OrderStatus.WORKING,
          customerId: input.customerId ?? null,
          carId: input.carId ?? null,
          workerId: input.workerId ?? null,
          createdBy: userId,
        },
      });

      await tx.calendarEntryOrder.create({
        data: {
          id: uuidv6(),
          entryId,
          orderId: order.id,
          tenantId,
          createdBy: userId,
        },
      });

      return order as OrderModel;
    });
  }

  private isBlockedByStatus(orderStatus: OrderStatus): boolean {
    return (
      orderStatus == OrderStatus.CLOSED || orderStatus == OrderStatus.CANCELLED
    );
  }

  async isOrderEditable(ctx: AuthContext, orderId: string): Promise<boolean> {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, tenantId: ctx.tenantId },
      select: { status: true },
    });
    if (!order) return false;
    return !this.isBlockedByStatus(order.status);
  }

  async getCloseValidation(
    ctx: AuthContext,
    orderId: string,
  ): Promise<{
    canClose: boolean;
    closeDeficiencies: string[];
  }> {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, tenantId: ctx.tenantId },
      select: {
        status: true,
        carId: true,
        mileage: true,
        items: {
          select: {
            type: true,
            service: { select: { workerId: true } },
            children: {
              select: {
                type: true,
                service: { select: { workerId: true } },
                children: {
                  select: {
                    type: true,
                    service: { select: { workerId: true } },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!order) {
      return { canClose: false, closeDeficiencies: [] };
    }

    if (this.isBlockedByStatus(order.status)) {
      return { canClose: false, closeDeficiencies: [] };
    }

    const deficiencies: string[] = [];

    if (order.carId != null && order.mileage == null) {
      deficiencies.push('MILEAGE_MISSING');
    }

    type ItemWithService = {
      type: string;
      service?: { workerId: string | null } | null;
      children?: ItemWithService[];
    };
    const hasServiceWithoutWorker = (item: ItemWithService): boolean => {
      if (item.type === '1' && item.service && item.service.workerId == null) {
        return true;
      }
      return item.children?.some(hasServiceWithoutWorker) ?? false;
    };
    const hasServicesWithoutWorker = order.items.some(hasServiceWithoutWorker);
    if (hasServicesWithoutWorker) {
      deficiencies.push('SERVICES_WITHOUT_WORKER');
    }

    return {
      canClose: deficiencies.length === 0,
      closeDeficiencies: deficiencies,
    };
  }

  async validateOrderEditable(
    ctx: AuthContext,
    orderId: string,
  ): Promise<void> {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, tenantId: ctx.tenantId },
      select: { status: true },
    });

    if (!order) {
      throw new NotFoundException(`Заказ с ID ${orderId} не найден`);
    }

    if (
      order.status === OrderStatus.CLOSED ||
      order.status === OrderStatus.CANCELLED
    ) {
      throw new BadRequestException(
        'Нельзя изменять элементы в закрытом или отмененном заказе',
      );
    }
  }

  /**
   * В рамках транзакции оприходования: если заказ в TRACKING и все OrderItemPart
   * с quantity > 0 имеют reserved >= quantity, переводит статус в NOTIFICATION.
   */
  async trySetNotificationIfFullyReserved(
    tx: Prisma.TransactionClient,
    orderId: string,
  ): Promise<void> {
    const order = await tx.order.findUnique({
      where: { id: orderId },
      select: { status: true, tenantId: true },
    });
    if (!order || order.status !== OrderStatus.TRACKING) return;

    const orderItemIds: string[] = [];
    let ids = (
      await tx.orderItem.findMany({
        where: { orderId },
        select: { id: true },
      })
    ).map((i) => i.id);
    while (ids.length > 0) {
      orderItemIds.push(...ids);
      ids = (
        await tx.orderItem.findMany({
          where: { parentId: { in: ids } },
          select: { id: true },
        })
      ).map((i) => i.id);
    }
    if (orderItemIds.length === 0) return;

    const parts = await tx.orderItemPart.findMany({
      where: { id: { in: orderItemIds }, quantity: { gt: 0 } },
      select: { id: true, quantity: true },
    });
    if (parts.length === 0) return;

    const reserved = await tx.reservation.groupBy({
      by: ['orderItemPartId'],
      where: {
        orderItemPartId: { in: parts.map((p) => p.id) },
      },
      _sum: { quantity: true },
    });
    const reservedMap = new Map(
      reserved.map((r) => [r.orderItemPartId, r._sum.quantity ?? 0]),
    );
    const allSatisfied = parts.every(
      (p) => (reservedMap.get(p.id) ?? 0) >= p.quantity,
    );
    if (!allSatisfied) return;

    await tx.order.update({
      where: { id: orderId },
      data: { status: OrderStatus.NOTIFICATION },
    });
  }

  async update(ctx: AuthContext, input: UpdateOrderInput): Promise<OrderModel> {
    await this.validateOrderEditable(ctx, input.id);

    if (
      input.status === OrderStatus.CLOSED ||
      input.status === OrderStatus.CANCELLED
    ) {
      throw new BadRequestException(
        'Нельзя переводить заказ в закрытый или отмененный статус',
      );
    }

    const data: Prisma.OrderUncheckedUpdateInput = {};

    if ('carId' in input) {
      data.carId = input.carId ?? null;
    }

    if ('customerId' in input) {
      data.customerId = input.customerId ?? null;
    }

    if ('workerId' in input) {
      data.workerId = input.workerId ?? null;
    }

    if ('mileage' in input) {
      data.mileage = input.mileage ?? null;
    }

    if (
      'status' in input &&
      input.status !== null &&
      input.status !== undefined
    ) {
      data.status = input.status;
    }

    return this.prisma.order.update({
      where: { id: input.id },
      data,
    }) as Promise<OrderModel>;
  }

  async cancelOrder(
    ctx: AuthContext,
    input: CancelOrderInput,
  ): Promise<OrderModel> {
    const { tenantId, userId } = ctx;
    await this.validateOrderEditable(ctx, input.orderId);

    const order = await this.prisma.order.findFirst({
      where: { id: input.orderId, tenantId },
      select: {
        id: true,
        number: true,
        customerId: true,
      },
    });
    if (!order) {
      throw new NotFoundException(`Заказ с ID ${input.orderId} не найден`);
    }

    const reasonText = this.buildCancelReasonText(
      input.reasonCode,
      input.reasonComment,
    );
    const saveToRecommendations = Boolean(input.saveToRecommendations);
    const createClientNote = Boolean(input.createClientNote);

    await this.prisma.$transaction(async (tx) => {
      const orderClose = await tx.orderClose.create({
        data: {
          orderId: input.orderId,
          tenantId,
          type: ORDER_CLOSE_TYPE_CANCEL,
        },
      });

      await tx.orderCancel.create({
        data: {
          id: orderClose.id,
          createdBy: userId,
        },
      });

      await tx.order.update({
        where: { id: input.orderId },
        data: { status: OrderStatus.CANCELLED },
      });

      const orderPartItems = await tx.orderItemPart.findMany({
        where: {
          orderItem: { orderId: input.orderId },
        },
        select: { id: true },
      });

      if (orderPartItems.length > 0) {
        await tx.reservation.deleteMany({
          where: {
            tenantId,
            orderItemPartId: { in: orderPartItems.map((item) => item.id) },
          },
        });
      }

      if (saveToRecommendations) {
        const serviceItems = await tx.orderItem.findMany({
          where: {
            orderId: input.orderId,
            type: '1',
          },
          select: { id: true },
        });

        for (const serviceItem of serviceItems) {
          await this.recommendationWorkMigrationService.syncWorkToRecommendation(
            ctx,
            {
              orderItemServiceId: serviceItem.id,
              deleteOrderItem: false,
              validateOrderEditable: false,
              tx,
              publishUpdates: false,
            },
          );
        }
      }

      const orderNoteText =
        `Отмена заказа: ${reasonText}. ` +
        `Работы сохранены в рекомендации: ${saveToRecommendations ? 'Да' : 'Нет'}.`;

      await tx.note.create({
        data: {
          subject: input.orderId,
          type: NoteType.WARNING,
          text: orderNoteText,
          isPublic: false,
          tenantId,
          createdBy: userId,
        },
      });

      if (createClientNote && order.customerId) {
        await tx.note.create({
          data: {
            subject: order.customerId,
            type: NoteType.WARNING,
            text: `Отменил заказ №${order.number}: ${reasonText}.`,
            isPublic: false,
            tenantId,
            createdBy: userId,
          },
        });
      }
    });

    return this.findOne(ctx, input.orderId) as Promise<OrderModel>;
  }

  /**
   * Закрыть заказ: OrderClose + OrderDeal, платежи при закрытии, перенос предоплат, списание заказа, статус CLOSED, затем зарплата по работам.
   * В OrderDeal.balance сохраняется баланс заказчика на момент закрытия до списания/начисления по заказу.
   */
  async closeOrder(
    ctx: AuthContext,
    input: CloseOrderInput,
  ): Promise<OrderModel> {
    const { tenantId, userId } = ctx;
    const order = await this.prisma.order.findFirst({
      where: { id: input.orderId, tenantId },
      select: {
        id: true,
        number: true,
        customerId: true,
        carId: true,
        mileage: true,
        close: { select: { id: true } },
      },
    });
    if (!order) {
      throw new NotFoundException(`Заказ с ID ${input.orderId} не найден`);
    }

    await this.validateOrderEditable(ctx, input.orderId);

    const closeValidation = await this.getCloseValidation(ctx, input.orderId);
    if (!closeValidation.canClose) {
      const messages: Record<string, string> = {
        MILEAGE_MISSING: 'Укажите пробег',
        SERVICES_WITHOUT_WORKER: 'Назначьте исполнителей на все работы',
      };
      const details = closeValidation.closeDeficiencies
        .map((d) => messages[d] ?? d)
        .join('; ');
      throw new BadRequestException(`Нельзя закрыть заказ: ${details}`);
    }

    const payments = input.payments ?? [];
    const currencyCode = await this.settingsService.getDefaultCurrencyCode();
    for (const p of payments) {
      const { amountMinor } = applyDefaultCurrency(p.amount, currencyCode);
      if (amountMinor <= 0n) {
        throw new BadRequestException(
          'Сумма платежа при закрытии должна быть положительной',
        );
      }
      const wallet = await this.prisma.wallet.findFirst({
        where: { id: p.walletId, tenantId },
      });
      if (!wallet) {
        throw new BadRequestException(`Счёт с ID ${p.walletId} не найден`);
      }
    }

    const satisfaction = input.satisfaction ?? 0;
    const balance =
      order.customerId != null
        ? await this.customerTransactionService.getBalance(
            ctx,
            order.customerId,
          )
        : 0n;
    const orderTotal = await this.getOrderTotal(ctx, input.orderId);

    await this.prisma.$transaction(async (tx) => {
      const orderClose = await tx.orderClose.create({
        data: {
          orderId: input.orderId,
          tenantId,
          type: ORDER_CLOSE_TYPE_DEAL,
        },
      });
      await tx.orderDeal.create({
        data: {
          id: orderClose.id,
          balance,
          satisfaction,
          createdBy: userId,
        },
      });

      for (const p of payments) {
        const { amountMinor, currencyCode: pCurrency } = applyDefaultCurrency(
          p.amount,
          currencyCode,
        );
        await this.walletTransactionService.createWithinTransaction(
          tx,
          {
            walletId: p.walletId,
            source: WalletTransactionSource.OrderDebit,
            sourceId: input.orderId,
            amount: { amountMinor, currencyCode: pCurrency },
          },
          tenantId,
          userId,
        );
        if (order.customerId != null) {
          await this.customerTransactionService.createWithinTransaction(
            tx,
            {
              operandId: order.customerId,
              source: CustomerTransactionSource.OrderDebit,
              sourceId: input.orderId,
              amount: { amountMinor, currencyCode: pCurrency },
            },
            tenantId,
            userId,
          );
        }
      }

      const prepayments = await tx.orderPayment.findMany({
        where: { orderId: input.orderId, tenantId },
      });
      if (order.customerId != null) {
        for (const prepay of prepayments) {
          const amount = prepay.amountAmount ?? 0n;
          if (amount === 0n) continue;
          const source =
            amount > 0n
              ? CustomerTransactionSource.OrderPrepay
              : CustomerTransactionSource.OrderPrepayRefund;
          await this.customerTransactionService.createWithinTransaction(
            tx,
            {
              operandId: order.customerId,
              source,
              sourceId: input.orderId,
              amount: {
                amountMinor: amount,
                currencyCode: prepay.amountCurrencyCode ?? currencyCode,
              },
            },
            tenantId,
            userId,
          );
        }
      }

      if (order.customerId != null && orderTotal > 0n) {
        await this.customerTransactionService.createWithinTransaction(
          tx,
          {
            operandId: order.customerId,
            source: CustomerTransactionSource.OrderPayment,
            sourceId: input.orderId,
            amount: {
              amountMinor: -orderTotal,
              currencyCode: currencyCode,
            },
          },
          tenantId,
          userId,
        );
      }

      await this.warehouseService.debitForOrder(tx, input.orderId, tenantId);

      await tx.order.update({
        where: { id: input.orderId },
        data: { status: OrderStatus.CLOSED },
      });

      await this.tasksService.createQualityControlTaskOnOrderClose(tx, ctx, {
        orderId: input.orderId,
        orderNumber: order.number,
        customerId: order.customerId,
        orderTotalMinor: orderTotal,
      });

      if (order.carId != null && order.mileage != null) {
        await tx.car.update({
          where: { id: order.carId },
          data: { mileage: order.mileage },
        });
      }
    });

    await this.salaryService.chargeByOrder(ctx, input.orderId);

    return this.findOne(ctx, input.orderId) as Promise<OrderModel>;
  }

  async ensureOrderClosed(ctx: AuthContext, orderId: string): Promise<void> {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, tenantId: ctx.tenantId },
      select: {
        id: true,
        close: { select: { orderDeal: { select: { id: true } } } },
      },
    });
    if (!order) {
      throw new NotFoundException(`Заказ с ID ${orderId} не найден`);
    }
    if (!order.close?.orderDeal) {
      throw new BadRequestException('Заказ не закрыт');
    }
  }

  async chargeOrderSalary(ctx: AuthContext, orderId: string): Promise<void> {
    await this.salaryService.chargeByOrder(ctx, orderId);
  }
}
