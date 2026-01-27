import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { OrderModel } from './models/order.model';
import { OrderStatus } from './enums/order-status.enum';
import { UpdateOrderInput } from './inputs/update-order.input';
import { Prisma } from 'src/generated/prisma/client';

@Injectable()
export class OrderService {
  constructor(private readonly prisma: PrismaService) {}

  async findOne(id: string): Promise<OrderModel | null> {
    return this.prisma.order.findUnique({
      where: { id },
    }) as Promise<OrderModel | null>;
  }

  async findAll(): Promise<OrderModel[]> {
    return this.prisma.order.findMany({
      take: 50,
      orderBy: [{ number: 'desc' }],
    }) as Promise<OrderModel[]>;
  }

  async validateOrderEditable(orderId: string): Promise<void> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
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
