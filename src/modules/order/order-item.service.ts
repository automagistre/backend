import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { OrderService } from './order.service';
import { OrderItemModel } from './models/order-item.model';
import { CreateOrderItemGroupInput } from './inputs/create-order-item-group.input';
import { CreateOrderItemServiceInput } from './inputs/create-order-item-service.input';
import { CreateOrderItemPartInput } from './inputs/create-order-item-part.input';
import { UpdateOrderItemPartInput } from './inputs/update-order-item-part.input';
import { UpdateOrderItemServiceInput } from './inputs/update-order-item-service.input';
import { UpdateOrderItemGroupInput } from './inputs/update-order-item-group.input';
import {
  OrderItem,
  OrderItemGroup,
  OrderItemService as PrismaOrderItemService,
  OrderItemPart,
  Prisma,
} from 'src/generated/prisma/client';
import { OrderItemType } from './enums/order-item-type.enum';
import { v6 as uuidv6 } from 'uuid';
import { ReservationService } from '../reservation/reservation.service';
import { applyDefaultCurrency } from 'src/common/money';
import { normalizeMoneyAmount } from 'src/common/utils/money.util';
import { SettingsService } from 'src/modules/settings/settings.service';
import type { AuthContext } from 'src/common/user-id.store';

@Injectable()
export class OrderItemService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly orderService: OrderService,
    private readonly reservationService: ReservationService,
    private readonly settingsService: SettingsService,
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

  private buildTree(
    items: (OrderItem & {
      group: OrderItemGroup | null;
      service: PrismaOrderItemService | null;
      part:
        | (OrderItemPart & {
            part: (any & { manufacturer: any }) | null;
            supplier: any | null;
          })
        | null;
    })[],
  ): OrderItemModel[] {
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

  private toModel(
    item: OrderItem & {
      group: OrderItemGroup | null;
      service: PrismaOrderItemService | null;
      part:
        | (OrderItemPart & {
            part: (any & { manufacturer: any }) | null;
            supplier: any | null;
          })
        | null;
    },
  ): OrderItemModel {
    const { group, service, part, type, ...orderItemData } = item;

    // Нормализуем тип из БД (может быть '1', '2', '3' или 'group', 'service', 'part')
    const normalizedType = this.normalizeType(type);

    // Явно создаем объекты с правильной структурой для GraphQL
    return {
      ...orderItemData,
      type: normalizedType,
      group: group ? { ...group } : null,
      service: service
        ? {
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
          }
        : null,
      part: part
        ? {
            ...part,
            part: part.part,
            supplier: part.supplier,
          }
        : null,
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
      service: OrderItemType.SERVICE,
      part: OrderItemType.PART,
      group: OrderItemType.GROUP,
    };

    return typeMap[typeStr] || OrderItemType.SERVICE; // По умолчанию service
  }

  async createGroup(
    ctx: AuthContext,
    input: CreateOrderItemGroupInput,
  ): Promise<OrderItemModel> {
    const { tenantId, userId } = ctx;
    await this.orderService.validateOrderEditable(ctx, input.orderId);

    const orderItem = await this.prisma.orderItem.create({
      data: {
        id: uuidv6(),
        orderId: input.orderId,
        parentId: input.parentId,
        type: '3',
        tenantId,
        group: {
          create: {
            name: input.name,
            hideParts: input.hideParts ?? false,
            createdBy: userId,
          },
        },
      },
      include: { group: true },
    });

    return this.toModel(orderItem as any);
  }

  async updateGroup(
    ctx: AuthContext,
    input: UpdateOrderItemGroupInput,
  ): Promise<OrderItemModel> {
    const orderItem = await this.prisma.orderItem.findUnique({
      where: { id: input.id },
      include: { group: true },
    });

    if (!orderItem) {
      throw new NotFoundException(`Элемент заказа с ID ${input.id} не найден`);
    }

    if (!orderItem.group) {
      throw new NotFoundException(
        `Элемент заказа с ID ${input.id} не является группой`,
      );
    }

    await this.orderService.validateOrderEditable(ctx, orderItem.orderId!);

    const updateData: { name?: string; hideParts?: boolean } = {};
    if (input.name !== undefined) updateData.name = input.name;
    if (input.hideParts !== undefined) updateData.hideParts = input.hideParts;

    if (Object.keys(updateData).length > 0) {
      await this.prisma.orderItemGroup.update({
        where: { id: input.id },
        data: updateData,
      });
    }

    const updated = await this.prisma.orderItem.findUnique({
      where: { id: input.id },
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

    return this.toModel(updated as any);
  }

  async createService(
    ctx: AuthContext,
    input: CreateOrderItemServiceInput,
  ): Promise<OrderItemModel> {
    const { tenantId, userId } = ctx;
    await this.orderService.validateOrderEditable(ctx, input.orderId);
    const defaultCurrency = await this.settingsService.getDefaultCurrencyCode();
    const priceData = input.price
      ? applyDefaultCurrency(input.price, defaultCurrency)
      : { amountMinor: 0n, currencyCode: defaultCurrency };
    const discountData = input.discount
      ? applyDefaultCurrency(input.discount, defaultCurrency)
      : { amountMinor: 0n, currencyCode: defaultCurrency };

    const orderItem = await this.prisma.orderItem.create({
      data: {
        id: uuidv6(),
        orderId: input.orderId,
        parentId: input.parentId,
        type: '1',
        tenantId,
        service: {
          create: {
            service: input.service,
            workerId: input.workerId,
            warranty: input.warranty ?? false,
            priceAmount: priceData.amountMinor,
            priceCurrencyCode: priceData.currencyCode,
            discountAmount: discountData.amountMinor,
            discountCurrencyCode: discountData.currencyCode,
            createdBy: userId,
          },
        },
      },
      include: { service: true },
    });

    return this.toModel(orderItem as any);
  }

  async createPart(
    ctx: AuthContext,
    input: CreateOrderItemPartInput,
  ): Promise<OrderItemModel> {
    const { tenantId, userId } = ctx;
    await this.orderService.validateOrderEditable(ctx, input.orderId);

    const part = await this.prisma.part.findUnique({
      where: { id: input.partId },
    });
    if (!part) {
      throw new NotFoundException(`Запчасть с ID ${input.partId} не найдена`);
    }

    if (input.supplierId) {
      const supplier = await this.prisma.organization.findUnique({
        where: { id: input.supplierId },
      });
      if (!supplier) {
        throw new NotFoundException(
          `Поставщик с ID ${input.supplierId} не найден`,
        );
      }
    }

    const defaultCurrency = await this.settingsService.getDefaultCurrencyCode();
    const priceData = input.price
      ? applyDefaultCurrency(input.price, defaultCurrency)
      : { amountMinor: 0n, currencyCode: defaultCurrency };
    const discountData = input.discount
      ? applyDefaultCurrency(input.discount, defaultCurrency)
      : { amountMinor: 0n, currencyCode: defaultCurrency };

    const orderItem = await this.prisma.orderItem.create({
      data: {
        id: uuidv6(),
        orderId: input.orderId,
        parentId: input.parentId,
        type: '2',
        tenantId,
        part: {
          create: {
            partId: input.partId,
            supplierId: input.supplierId,
            quantity: input.quantity,
            warranty: input.warranty ?? false,
            priceAmount: priceData.amountMinor,
            priceCurrencyCode: priceData.currencyCode,
            discountAmount: discountData.amountMinor,
            discountCurrencyCode: discountData.currencyCode,
            createdBy: userId,
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

    if (orderItem.part && input.quantity > 0) {
      try {
        await this.reservationService.reserve(ctx, {
          orderItemPartId: orderItem.part.id,
          quantity: input.quantity,
          tenantId,
        });
      } catch {
        // no-op
      }
    }

    return this.toModel(orderItem as any);
  }

  async createPartsForService(
    ctx: AuthContext,
    input: {
      orderId: string;
      parentId: string;
      parts: {
        partId: string;
        quantity: number;
        priceAmount?: bigint | null;
      }[];
      validateOrderEditable?: boolean;
    },
    prismaClient?: Prisma.TransactionClient,
  ): Promise<{ orderItemPartId: string; quantity: number }[]> {
    const { tenantId, userId } = ctx;
    if (input.validateOrderEditable !== false) {
      await this.orderService.validateOrderEditable(ctx, input.orderId);
    }

    if (input.parts.length === 0) {
      return [];
    }

    const client = prismaClient ?? this.prisma;
    const partIds = Array.from(new Set(input.parts.map((part) => part.partId)));

    const existing = await client.part.findMany({
      where: { id: { in: partIds } },
      select: { id: true },
    });

    if (existing.length !== partIds.length) {
      const existingIds = new Set(existing.map((part) => part.id));
      const missingId = partIds.find((id) => !existingIds.has(id));
      throw new NotFoundException(`Запчасть с ID ${missingId} не найдена`);
    }

    const defaultCurrency = await this.settingsService.getDefaultCurrencyCode();
    const orderItemsData: Prisma.OrderItemCreateManyInput[] = [];
    const orderItemPartsData: Prisma.OrderItemPartCreateManyInput[] = [];
    const result: { orderItemPartId: string; quantity: number }[] = [];

    for (const part of input.parts) {
      const orderItemPartId = uuidv6();
      const priceAmount = normalizeMoneyAmount(part.priceAmount ?? null);

      orderItemsData.push({
        id: orderItemPartId,
        orderId: input.orderId,
        parentId: input.parentId,
        type: '2',
        tenantId,
      });

      orderItemPartsData.push({
        id: orderItemPartId,
        partId: part.partId,
        supplierId: null,
        quantity: part.quantity,
        warranty: false,
        priceAmount,
        priceCurrencyCode: defaultCurrency,
        discountAmount: normalizeMoneyAmount(undefined),
        discountCurrencyCode: defaultCurrency,
        createdBy: userId,
      });

      result.push({ orderItemPartId, quantity: part.quantity });
    }

    await client.orderItem.createMany({ data: orderItemsData });
    await client.orderItemPart.createMany({ data: orderItemPartsData });

    return result;
  }

  async reservePartsBestEffort(
    ctx: AuthContext,
    parts: { orderItemPartId: string; quantity: number }[],
  ): Promise<void> {
    for (const part of parts) {
      if (part.quantity <= 0) continue;
      try {
        await this.reservationService.reserve(ctx, {
          orderItemPartId: part.orderItemPartId,
          quantity: part.quantity,
          tenantId: ctx.tenantId,
        });
      } catch {
        // no-op
      }
    }
  }

  async updatePart(
    ctx: AuthContext,
    input: UpdateOrderItemPartInput,
  ): Promise<OrderItemModel> {
    const orderItem = await this.prisma.orderItem.findUnique({
      where: { id: input.id },
      include: { part: true },
    });

    if (!orderItem) {
      throw new NotFoundException(`Элемент заказа с ID ${input.id} не найден`);
    }

    if (!orderItem.part) {
      throw new NotFoundException(
        `Элемент заказа с ID ${input.id} не является запчастью`,
      );
    }

    await this.orderService.validateOrderEditable(ctx, orderItem.orderId!);

    const isPartChanged =
      input.partId !== undefined && input.partId !== orderItem.part.partId;
    const isQuantityChanged =
      input.quantity !== undefined && input.quantity !== orderItem.part.quantity;

    // При замене запчасти или изменении количества пересобираем резерв:
    // сначала снимаем старый, затем после апдейта пытаемся поставить новый.
    const shouldRebuildReservation = isPartChanged || isQuantityChanged;

    if (isPartChanged) {
      const part = await this.prisma.part.findUnique({
        where: { id: input.partId },
        select: { id: true },
      });
      if (!part) {
        throw new NotFoundException(`Запчасть с ID ${input.partId} не найдена`);
      }
    }

    if (shouldRebuildReservation) {
      await this.reservationService.releaseAll(orderItem.part.id);
    }

    // Обновляем только переданные поля
    const updateData: any = {};
    if (input.partId !== undefined) updateData.partId = input.partId;
    if (input.quantity !== undefined) updateData.quantity = input.quantity;
    if (input.price !== undefined) {
      const defaultCurrency =
        await this.settingsService.getDefaultCurrencyCode();
      const priceData =
        input.price != null
          ? applyDefaultCurrency(input.price, defaultCurrency)
          : { amountMinor: 0n, currencyCode: defaultCurrency };
      updateData.priceAmount = priceData.amountMinor;
      updateData.priceCurrencyCode = priceData.currencyCode;
    }
    if (input.discount !== undefined) {
      const defaultCurrency =
        await this.settingsService.getDefaultCurrencyCode();
      const discountData =
        input.discount != null
          ? applyDefaultCurrency(input.discount, defaultCurrency)
          : { amountMinor: 0n, currencyCode: defaultCurrency };
      updateData.discountAmount = discountData.amountMinor;
      updateData.discountCurrencyCode = discountData.currencyCode;
    }
    if (input.warranty !== undefined) updateData.warranty = input.warranty;
    if (input.supplierId !== undefined)
      updateData.supplierId = input.supplierId;
    if (input.parentId !== undefined) {
      await this.prisma.orderItem.update({
        where: { id: input.id },
        data: { parentId: input.parentId },
      });
    }

    if (Object.keys(updateData).length > 0) {
      await this.prisma.orderItemPart.update({
        where: { id: orderItem.part.id },
        data: updateData,
      });
    }

    if (shouldRebuildReservation) {
      const nextQuantity = input.quantity ?? orderItem.part.quantity;
      if (nextQuantity > 0) {
        try {
          await this.reservationService.reserve(ctx, {
            orderItemPartId: orderItem.part.id,
            quantity: nextQuantity,
            tenantId: orderItem.tenantId,
          });
        } catch {
          // no-op
        }
      }
    }

    const updated = await this.prisma.orderItem.findUnique({
      where: { id: input.id },
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

    return this.toModel(updated as any);
  }

  async updateService(
    ctx: AuthContext,
    input: UpdateOrderItemServiceInput,
  ): Promise<OrderItemModel> {
    const orderItem = await this.prisma.orderItem.findUnique({
      where: { id: input.id },
      include: { service: true },
    });

    if (!orderItem) {
      throw new NotFoundException(`Элемент заказа с ID ${input.id} не найден`);
    }

    if (!orderItem.service) {
      throw new NotFoundException(
        `Элемент заказа с ID ${input.id} не является услугой`,
      );
    }

    await this.orderService.validateOrderEditable(ctx, orderItem.orderId!);

    // Обновляем только переданные поля
    const updateData: any = {};
    if (input.service !== undefined) updateData.service = input.service;
    if (input.price !== undefined) {
      const defaultCurrency =
        await this.settingsService.getDefaultCurrencyCode();
      const priceData =
        input.price != null
          ? applyDefaultCurrency(input.price, defaultCurrency)
          : { amountMinor: 0n, currencyCode: defaultCurrency };
      updateData.priceAmount = priceData.amountMinor;
      updateData.priceCurrencyCode = priceData.currencyCode;
    }
    if (input.discount !== undefined) {
      const defaultCurrency =
        await this.settingsService.getDefaultCurrencyCode();
      const discountData =
        input.discount != null
          ? applyDefaultCurrency(input.discount, defaultCurrency)
          : { amountMinor: 0n, currencyCode: defaultCurrency };
      updateData.discountAmount = discountData.amountMinor;
      updateData.discountCurrencyCode = discountData.currencyCode;
    }
    if (input.warranty !== undefined) updateData.warranty = input.warranty;
    if (input.workerId !== undefined) updateData.workerId = input.workerId;
    if (input.parentId !== undefined) {
      await this.prisma.orderItem.update({
        where: { id: input.id },
        data: { parentId: input.parentId },
      });
    }

    if (Object.keys(updateData).length > 0) {
      await this.prisma.orderItemService.update({
        where: { id: orderItem.service.id },
        data: updateData,
      });
    }

    const updated = await this.prisma.orderItem.findUnique({
      where: { id: input.id },
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

    return this.toModel(updated as any);
  }

  async delete(
    ctx: AuthContext,
    id: string,
    deleteChildren: boolean = true,
    options?: {
      tx?: Prisma.TransactionClient;
      skipValidation?: boolean;
    },
  ): Promise<OrderItemModel> {
    const client = options?.tx ?? this.prisma;

    const orderItem = await client.orderItem.findUnique({
      where: { id },
      include: {
        part: true,
        service: true,
        group: true,
      },
    });

    if (!orderItem) {
      throw new NotFoundException(`Элемент заказа с ID ${id} не найден`);
    }

    if (!options?.skipValidation) {
      await this.orderService.validateOrderEditable(ctx, orderItem.orderId!);
    }

    // Снимаем резерв если это запчасть (best-effort, вне транзакции)
    if (orderItem.part) {
      await this.reservationService.releaseAll(orderItem.part.id);
    }

    // Обрабатываем дочерние элементы
    if (!deleteChildren) {
      // Перемещаем дочерние элементы в корень (parentId = null)
      await client.orderItem.updateMany({
        where: { parentId: id },
        data: { parentId: null },
      });
    } else {
      // Удаляем дочерние элементы вместе с их резервациями
      const childParts = await client.orderItem.findMany({
        where: { parentId: id },
        include: { part: true },
      });

      // Рекурсивно удаляем резервации для всех дочерних запчастей
      for (const child of childParts) {
        if (child.part) {
          await this.reservationService.releaseAll(child.part.id);
        }
        // Рекурсивно обрабатываем внуков
        await this.deleteChildReservations(child.id, client);
      }
    }

    const deleted = await client.orderItem.delete({
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

  /**
   * Рекурсивно удаляет резервации для всех дочерних запчастей
   */
  private async deleteChildReservations(
    parentId: string,
    client?: Prisma.TransactionClient | PrismaService,
  ): Promise<void> {
    const prismaClient = client ?? this.prisma;
    const children = await prismaClient.orderItem.findMany({
      where: { parentId },
      include: { part: true },
    });

    for (const child of children) {
      if (child.part) {
        await this.reservationService.releaseAll(child.part.id);
      }
      await this.deleteChildReservations(child.id, prismaClient);
    }
  }
}
