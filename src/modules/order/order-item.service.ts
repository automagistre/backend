import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { OrderService } from './order.service';
import { OrderItemModel } from './models/order-item.model';
import { CreateOrderItemGroupInput } from './inputs/create-order-item-group.input';
import { CreateOrderItemServiceInput } from './inputs/create-order-item-service.input';
import { CreateOrderItemPartInput } from './inputs/create-order-item-part.input';
import { OrderItem, OrderItemGroup, OrderItemService as PrismaOrderItemService, OrderItemPart } from 'src/generated/prisma/client';
import { OrderItemType } from './enums/order-item-type.enum';
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
    const { group, service, part, type, ...orderItemData } = item;
    
    // Нормализуем тип из БД (может быть '1', '2', '3' или 'group', 'service', 'part')
    const normalizedType = this.normalizeType(type);
    
    // Явно создаем объекты с правильной структурой для GraphQL
    return {
      ...orderItemData,
      type: normalizedType,
      group: group ? { ...group } : null,
      service: service ? {
        id: service.id,
        service: service.service,
        workerId: service.workerId,
        warranty: service.warranty,
        priceAmount: service.priceAmount,
        priceCurrencyCode: service.priceCurrencyCode,
        discountAmount: service.discountAmount,
        discountCurrencyCode: service.discountCurrencyCode,
        createdAt: service.createdAt,
        createdBy: service.createdBy,
        // worker будет загружен через ResolveField
      } : null,
      part: part ? {
        ...part,
        part: part.part,
        supplier: part.supplier,
      } : null,
      children: [],
    };
  }

  /**
   * Нормализует тип элемента заказа из БД в enum
   * В БД может храниться как число ('1', '2', '3') или строка ('group', 'service', 'part')
   */
  private normalizeType(type: string | number): OrderItemType {
    // Преобразуем в строку для единообразной обработки
    const typeStr = String(type);
    
    // Маппинг числовых типов: 1 = service, 2 = part, 3 = group
    const typeMap: Record<string, OrderItemType> = {
      '1': OrderItemType.SERVICE,
      '2': OrderItemType.PART,
      '3': OrderItemType.GROUP,
      'service': OrderItemType.SERVICE,
      'part': OrderItemType.PART,
      'group': OrderItemType.GROUP,
    };

    return typeMap[typeStr] || OrderItemType.SERVICE; // По умолчанию service
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

