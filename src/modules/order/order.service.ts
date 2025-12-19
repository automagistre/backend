import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { OrderModel } from './models/order.model';

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
}

