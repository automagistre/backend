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
import { Prisma } from 'src/generated/prisma/client';
import { TenantService } from 'src/common/services/tenant.service';

@Injectable()
export class OrderService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantService: TenantService,
  ) {}

  async findOne(id: string): Promise<OrderModel | null> {
    const tenantId = await this.tenantService.getTenantId();
    return this.prisma.order.findFirst({
      where: { id, tenantId },
    }) as Promise<OrderModel | null>;
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
