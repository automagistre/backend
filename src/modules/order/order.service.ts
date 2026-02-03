import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { OrderModel } from './models/order.model';
import { OrderStatus } from './enums/order-status.enum';
import { UpdateOrderInput } from './inputs/update-order.input';
import { CreateOrderInput } from './inputs/create-order.input';
import { CreateOrderPrepayInput } from './inputs/create-order-prepay.input';
import { Prisma } from 'src/generated/prisma/client';
import { TenantService } from 'src/common/services/tenant.service';
import { WalletTransactionService } from 'src/modules/wallet/wallet-transaction.service';
import { WalletTransactionSource } from 'src/modules/wallet/enums/wallet-transaction-source.enum';

const DELETE_COOLING_HOURS = 3;

@Injectable()
export class OrderService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantService: TenantService,
    private readonly walletTransactionService: WalletTransactionService,
  ) {}

  async findOne(id: string): Promise<OrderModel | null> {
    const tenantId = await this.tenantService.getTenantId();
    return this.prisma.order.findFirst({
      where: { id, tenantId },
    }) as Promise<OrderModel | null>;
  }

  /**
   * Строка для отображения в проводках: номер заказа и имя клиента (ФИО персоны или название организации).
   */
  /**
   * Создание предоплаты по заказу: order_payment + wallet_transaction в одной транзакции.
   * Возвращает созданную проводку по кошельку (для списка предоплат).
   */
  async createPrepay(input: CreateOrderPrepayInput) {
    await this.validateOrderEditable(input.orderId);
    const tenantId = await this.tenantService.getTenantId();
    const wallet = await this.prisma.wallet.findFirst({
      where: { id: input.walletId, tenantId },
    });
    if (!wallet) throw new NotFoundException('Счёт не найден');
    const amountCurrencyCode = input.amountCurrencyCode ?? 'RUB';
    return this.prisma.$transaction(async (tx) => {
      await tx.orderPayment.create({
        data: {
          orderId: input.orderId,
          tenantId,
          amountAmount: input.amountAmount,
          amountCurrencyCode,
          description: input.description ?? null,
        },
      });
      return this.walletTransactionService.createWithinTransaction(
        tx,
        {
          walletId: input.walletId,
          source: WalletTransactionSource.OrderPrepay,
          sourceId: input.orderId,
          amountAmount: input.amountAmount,
          amountCurrencyCode,
          description: input.description ?? null,
        },
        tenantId,
      );
    });
  }

  /** Предоплаты по заказу из таблицы order_payment. */
  async findPaymentsByOrderId(orderId: string) {
    const tenantId = await this.tenantService.getTenantId();
    return this.prisma.orderPayment.findMany({
      where: { orderId, tenantId },
      orderBy: [{ createdAt: 'asc' }],
    });
  }

  async getDisplayContext(orderId: string): Promise<string> {
    const tenantId = await this.tenantService.getTenantId();
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, tenantId },
      select: { number: true, customerId: true, customer: { select: { lastname: true, firstname: true } } },
    });
    if (!order) return '';
    const parts = [`№${order.number}`];
    if (order.customerId) {
      const personName =
        order.customer &&
        [order.customer.lastname, order.customer.firstname].filter(Boolean).join(' ');
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

  async findMany({
    take,
    skip,
    search,
    status,
  }: {
    take?: number;
    skip?: number;
    search?: string;
    status?: OrderStatus[];
  }): Promise<{ items: OrderModel[]; total: number }> {
    const tenantId = await this.tenantService.getTenantId();
    const where = this.buildOrdersWhere(tenantId, search, status);
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

  async findActiveOrders({
    search,
    status,
  }: {
    search?: string;
    status?: OrderStatus[];
  } = {}): Promise<OrderModel[]> {
    const { start, end } = this.getBusinessDayRange();
    const tenantId = await this.tenantService.getTenantId();

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

    const where = this.buildOrdersWhere(tenantId, search, status, activeWhere);

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
  ): Record<string, unknown> {
    const and: Record<string, unknown>[] = [{ ...baseWhere }];
    if (status?.length) {
      and.push({ status: { in: status } });
    }
    if (search?.trim()) {
      const term = search.trim();
      const num = Number(term);
      const searchOr = [
        ...(Number.isInteger(num) ? [{ number: num }] : []),
        { car: { gosnomer: { contains: term, mode: 'insensitive' } } },
        { customer: { firstname: { contains: term, mode: 'insensitive' } } },
        { customer: { lastname: { contains: term, mode: 'insensitive' } } },
        { customer: { telephone: { contains: term, mode: 'insensitive' } } },
      ].filter(Boolean);
      if (searchOr.length) {
        and.push({ OR: searchOr });
      }
    }
    return and.length === 1 ? (and[0] as Record<string, unknown>) : { AND: and };
  }

  private async checkCanDelete(orderId: string): Promise<
    | { deletable: true }
    | { deletable: false; notFound?: boolean; message: string }
  > {
    const tenantId = await this.tenantService.getTenantId();
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, tenantId },
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

  async canDeleteOrder(orderId: string): Promise<boolean> {
    const result = await this.checkCanDelete(orderId);
    return result.deletable;
  }

  async deleteOrder(orderId: string): Promise<boolean> {
    const result = await this.checkCanDelete(orderId);
    if (!result.deletable) {
      if (result.notFound) {
        throw new NotFoundException(result.message);
      }
      throw new BadRequestException(result.message);
    }
    await this.prisma.order.delete({ where: { id: orderId } });
    return true;
  }

  async getClosedAt(orderId: string): Promise<Date | null> {
    const tenantId = await this.tenantService.getTenantId();
    const close = await this.prisma.orderClose.findFirst({
      where: { orderId, tenantId },
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

  private getBusinessDayRange(now: Date = new Date()): { start: Date; end: Date } {
    const shifted = new Date(now);
    shifted.setHours(shifted.getHours() - 3);

    const start = new Date(shifted);
    start.setHours(3, 0, 0, 0);

    const end = new Date(start);
    end.setDate(start.getDate() + 1);

    return { start, end };
  }

  async create(input: CreateOrderInput): Promise<OrderModel> {
    const tenantId = await this.tenantService.getTenantId();
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
      },
    }) as Promise<OrderModel>;
  }

  async validateOrderEditable(orderId: string): Promise<void> {
    const tenantId = await this.tenantService.getTenantId();
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, tenantId },
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

  async update(input: UpdateOrderInput): Promise<OrderModel> {
    await this.validateOrderEditable(input.id);

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
}
