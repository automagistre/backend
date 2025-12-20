import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { OrderService } from './order.service';
import { OrderItemModel } from './models/order-item.model';
import { CreateOrderItemGroupInput } from './inputs/create-order-item-group.input';
import { CreateOrderItemServiceInput } from './inputs/create-order-item-service.input';
import { CreateOrderItemPartInput } from './inputs/create-order-item-part.input';
import { OrderItem, OrderItemGroup, OrderItemService as PrismaOrderItemService, OrderItemPart } from 'src/generated/prisma/client';
import { v6 as uuidv6 } from 'uuid';

@Injectable()
export class OrderItemService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly orderService: OrderService,
  ) {}

  async findTreeByOrderId(orderId: string): Promise<OrderItemModel[]> {
    const items = await this.prisma.orderItem.findMany({
      where: { orderId },
      include: {
        group: true,
        service: true,
        part: {
          include: {
            part: {
              include: {
                manufacturer: true,
              },
            },
            supplier: true,
          },
        },
      },
      orderBy: { id: 'asc' },
    });

    return this.buildTree(items);
  }

  private buildTree(items: (OrderItem & { group: OrderItemGroup | null; service: PrismaOrderItemService | null; part: (OrderItemPart & { part: (any & { manufacturer: any }) | null; supplier: any | null }) | null })[]): OrderItemModel[] {
    const map = new Map<string, OrderItemModel>();
    const roots: OrderItemModel[] = [];

    items.forEach((item) => {
      map.set(item.id, this.toModel(item));
    });

    items.forEach((item) => {
      const model = map.get(item.id)!;
      if (item.parentId) {
        const parent = map.get(item.parentId);
        if (parent) {
          parent.children.push(model);
        }
      } else {
        roots.push(model);
      }
    });

    return roots;
  }

  private toModel(item: OrderItem & { group: OrderItemGroup | null; service: PrismaOrderItemService | null; part: (OrderItemPart & { part: (any & { manufacturer: any }) | null; supplier: any | null }) | null }): OrderItemModel {
    const { group, service, part, ...orderItemData } = item;
    
    return {
      ...orderItemData,
      group: group ? { ...group } : null,
      service: service ? { ...service } : null,
      part: part ? {
        ...part,
        part: part.part,
        supplier: part.supplier,
      } : null,
      children: [],
    };
  }

  async createGroup(input: CreateOrderItemGroupInput): Promise<OrderItemModel> {
    await this.orderService.validateOrderEditable(input.orderId);

    const orderItem = await this.prisma.orderItem.create({
      data: {
        id: uuidv6(),
        orderId: input.orderId,
        parentId: input.parentId,
        type: 'group',
        tenantId: input.tenantId,
        group: {
          create: {
            name: input.name,
            hideParts: input.hideParts ?? false,
          },
        },
      },
      include: { group: true },
    });

    return this.toModel(orderItem as any);
  }

  async createService(input: CreateOrderItemServiceInput): Promise<OrderItemModel> {
    await this.orderService.validateOrderEditable(input.orderId);

    const orderItem = await this.prisma.orderItem.create({
      data: {
        id: uuidv6(),
        orderId: input.orderId,
        parentId: input.parentId,
        type: 'service',
        tenantId: input.tenantId,
        service: {
          create: {
            service: input.service,
            workerId: input.workerId,
            warranty: input.warranty ?? false,
            priceAmount: input.priceAmount,
            priceCurrencyCode: input.priceAmount ? 'RUB' : null,
            discountAmount: input.discountAmount,
            discountCurrencyCode: input.discountAmount ? 'RUB' : null,
          },
        },
      },
      include: { service: true },
    });

    return this.toModel(orderItem as any);
  }

  async createPart(input: CreateOrderItemPartInput): Promise<OrderItemModel> {
    await this.orderService.validateOrderEditable(input.orderId);

    const part = await this.prisma.part.findUnique({ where: { id: input.partId } });
    if (!part) {
      throw new NotFoundException(`Запчасть с ID ${input.partId} не найдена`);
    }

    if (input.supplierId) {
      const supplier = await this.prisma.organization.findUnique({ where: { id: input.supplierId } });
      if (!supplier) {
        throw new NotFoundException(`Поставщик с ID ${input.supplierId} не найден`);
      }
    }

    const orderItem = await this.prisma.orderItem.create({
      data: {
        id: uuidv6(),
        orderId: input.orderId,
        parentId: input.parentId,
        type: 'part',
        tenantId: input.tenantId,
        part: {
          create: {
            partId: input.partId,
            supplierId: input.supplierId,
            quantity: input.quantity,
            warranty: input.warranty ?? false,
            priceAmount: input.priceAmount,
            priceCurrencyCode: input.priceAmount ? 'RUB' : null,
            discountAmount: input.discountAmount,
            discountCurrencyCode: input.discountAmount ? 'RUB' : null,
          },
        },
      },
      include: {
        part: {
          include: {
            part: {
              include: {
                manufacturer: true,
              },
            },
            supplier: true,
          },
        },
      },
    });

    return this.toModel(orderItem as any);
  }

  async delete(id: string): Promise<OrderItemModel> {
    const orderItem = await this.prisma.orderItem.findUnique({
      where: { id },
      include: { part: true },
    });

    if (!orderItem) {
      throw new NotFoundException(`Элемент заказа с ID ${id} не найден`);
    }

    await this.orderService.validateOrderEditable(orderItem.orderId!);

    const deleted = await this.prisma.orderItem.delete({
      where: { id },
      include: {
        group: true,
        service: true,
        part: {
          include: {
            part: {
              include: {
                manufacturer: true,
              },
            },
            supplier: true,
          },
        },
      },
    });

    return this.toModel(deleted as any);
  }
}

