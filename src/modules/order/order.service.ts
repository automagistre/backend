import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { OrderModel } from './models/order.model';
import { OrderStatus } from './enums/order-status.enum';

@Injectable()
export class OrderService {
  constructor(private readonly prisma: PrismaService) {}

  async findOne(id: string): Promise<OrderModel | null> {
    return this.prisma.order.findUnique({
      where: { id },
    });
  }

  async findAll(): Promise<OrderModel[]> {
    const orders = await this.prisma.order.findMany({
      take: 50,
      include: {
        car: {
          include: {
            vehicle: {
              include: {
                manufacturer: true,
              },
            },
          },
        },
        customer: true,
      },
      orderBy: [{ number: 'desc' }],
    });
    return orders as OrderModel[];
  }

  async validateOrderEditable(orderId: string): Promise<void> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: { status: true },
    });

    if (!order) {
      throw new NotFoundException(`Заказ с ID ${orderId} не найден`);
    }

    if (order.status === OrderStatus.CLOSED || order.status === OrderStatus.CANCELLED) {
      throw new BadRequestException('Нельзя изменять элементы в закрытом или отмененном заказе');
    }
  }
}

