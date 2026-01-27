import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { Reservation } from 'src/generated/prisma/client';
import { TenantService } from 'src/common/services/tenant.service';
import { OrderStatus } from '../order/enums/order-status.enum';

export interface ReservePartInput {
  orderItemPartId: string;
  quantity: number;
  tenantId?: string;
}

export interface ReleaseReservationInput {
  orderItemPartId: string;
  quantity?: number; // Если не указано - снимаем весь резерв
}

export interface TransferReservationInput {
  fromOrderItemPartId: string;
  toOrderItemPartId: string;
  quantity: number;
  tenantId?: string;
}

@Injectable()
export class ReservationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantService: TenantService,
  ) {}

  private async getStockQuantity(partId: string, tenantId: string): Promise<number> {
    const result = await this.prisma.motion.aggregate({
      where: { partId, tenantId },
      _sum: { quantity: true },
    });
    return result._sum.quantity ?? 0;
  }

  private async getTotalReservedInActiveOrders(
    partId: string,
    tenantId: string,
  ): Promise<number> {
    const result = await this.prisma.reservation.aggregate({
      where: {
        tenantId,
        orderItemPart: {
          partId,
          orderItem: {
            order: {
              status: {
                notIn: [OrderStatus.CLOSED, OrderStatus.CANCELLED],
              },
            },
          },
        },
      },
      _sum: { quantity: true },
    });
    return result._sum.quantity ?? 0;
  }

  async getReservable(partId: string, tenantId?: string): Promise<number> {
    const resolvedTenantId = tenantId ?? (await this.tenantService.getTenantId());
    const stockQuantity = await this.getStockQuantity(partId, resolvedTenantId);
    const totalReservedActive = await this.getTotalReservedInActiveOrders(
      partId,
      resolvedTenantId,
    );
    return stockQuantity - totalReservedActive;
  }

  async getReservationSources(
    partId: string,
    excludeOrderId?: string,
    tenantId?: string,
  ): Promise<
    Array<{
      orderId: string;
      orderNumber: number;
      orderStatus: number;
      orderItemPartId: string;
      reservedQuantity: number;
    }>
  > {
    const resolvedTenantId = tenantId ?? (await this.tenantService.getTenantId());

    const groups = await this.prisma.reservation.groupBy({
      by: ['orderItemPartId'],
      where: {
        tenantId: resolvedTenantId,
        orderItemPart: {
          partId,
          orderItem: {
            ...(excludeOrderId ? { orderId: { not: excludeOrderId } } : {}),
            order: {
              status: {
                notIn: [OrderStatus.CLOSED, OrderStatus.CANCELLED],
              },
            },
          },
        },
      },
      _sum: { quantity: true },
    });

    const filtered = groups
      .map((g) => ({
        orderItemPartId: g.orderItemPartId,
        reservedQuantity: g._sum.quantity ?? 0,
      }))
      .filter((g) => g.reservedQuantity > 0);

    if (filtered.length === 0) {
      return [];
    }

    const ids = filtered.map((g) => g.orderItemPartId);
    const parts = await this.prisma.orderItemPart.findMany({
      where: { id: { in: ids } },
      include: { orderItem: { include: { order: true } } },
    });

    const byId = new Map(parts.map((p) => [p.id, p]));

    return filtered
      .map((g) => {
        const oip = byId.get(g.orderItemPartId);
        const order = oip?.orderItem?.order;
        if (!oip || !order) return null;
        return {
          orderId: order.id,
          orderNumber: order.number,
          orderStatus: order.status,
          orderItemPartId: g.orderItemPartId,
          reservedQuantity: g.reservedQuantity,
        };
      })
      .filter(Boolean) as Array<{
      orderId: string;
      orderNumber: number;
      orderStatus: number;
      orderItemPartId: string;
      reservedQuantity: number;
    }>;
  }

  async getOrderIdByOrderItemPartId(
    orderItemPartId: string,
  ): Promise<string | null> {
    const oip = await this.prisma.orderItemPart.findUnique({
      where: { id: orderItemPartId },
      include: { orderItem: true },
    });
    return oip?.orderItem?.orderId ?? null;
  }

  async transferReservation(input: TransferReservationInput): Promise<{
    fromOrderId: string | null;
    toOrderId: string | null;
  }> {
    const { fromOrderItemPartId, toOrderItemPartId, quantity } = input;
    const tenantId = input.tenantId ?? (await this.tenantService.getTenantId());

    if (quantity <= 0) {
      throw new BadRequestException(
        'Количество для переноса резерва должно быть больше 0',
      );
    }

    if (fromOrderItemPartId === toOrderItemPartId) {
      throw new BadRequestException('Нельзя переносить резерв в ту же позицию');
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const [from, to] = await Promise.all([
        tx.orderItemPart.findUnique({
          where: { id: fromOrderItemPartId },
          include: { orderItem: { include: { order: true } } },
        }),
        tx.orderItemPart.findUnique({
          where: { id: toOrderItemPartId },
          include: { orderItem: { include: { order: true } } },
        }),
      ]);

      if (!from) {
        throw new BadRequestException(
          `Позиция-источник с ID ${fromOrderItemPartId} не найдена`,
        );
      }
      if (!to) {
        throw new BadRequestException(
          `Позиция-получатель с ID ${toOrderItemPartId} не найдена`,
        );
      }

      if (from.partId !== to.partId) {
        throw new BadRequestException(
          'Перенос резерва возможен только для одной и той же запчасти',
        );
      }

      const fromOrderStatus = from.orderItem?.order?.status;
      const toOrderStatus = to.orderItem?.order?.status;
      if (
        fromOrderStatus === OrderStatus.CLOSED ||
        fromOrderStatus === OrderStatus.CANCELLED ||
        toOrderStatus === OrderStatus.CLOSED ||
        toOrderStatus === OrderStatus.CANCELLED
      ) {
        throw new BadRequestException(
          'Нельзя переносить резерв из/в закрытый или отменённый заказ',
        );
      }

      const fromAgg = await tx.reservation.aggregate({
        where: { tenantId, orderItemPartId: fromOrderItemPartId },
        _sum: { quantity: true },
      });
      const fromReserved = fromAgg._sum.quantity ?? 0;
      if (fromReserved < quantity) {
        throw new BadRequestException(
          `Недостаточно резерва в позиции-источнике: в резерве "${fromReserved}", требуется "${quantity}"`,
        );
      }

      // При "занять" намеренно снимаем резерв ИСТОЧНИКА полностью.
      // Причина: после займа в исходном заказе должна появляться недостача, а не оставаться "OK".
      await tx.reservation.deleteMany({
        where: { tenantId, orderItemPartId: fromOrderItemPartId },
      });

      await tx.reservation.create({
        data: {
          orderItemPartId: toOrderItemPartId,
          quantity,
          tenantId,
        },
      });

      return {
        fromOrderId: from.orderItem?.orderId ?? null,
        toOrderId: to.orderItem?.orderId ?? null,
      };
    });

    return result;
  }

  /**
   * Резервирование запчасти для элемента заказа
   */
  async reserve(input: ReservePartInput): Promise<Reservation> {
    const { orderItemPartId, quantity } = input;
    const tenantId = input.tenantId ?? (await this.tenantService.getTenantId());

    if (quantity <= 0) {
      throw new BadRequestException(
        'Количество для резервирования должно быть больше 0',
      );
    }

    // Проверяем существование order_item_part
    const orderItemPart = await this.prisma.orderItemPart.findUnique({
      where: { id: orderItemPartId },
      include: { part: true },
    });

    if (!orderItemPart) {
      throw new BadRequestException(
        `Элемент заказа с ID ${orderItemPartId} не найден`,
      );
    }

    // Проверяем, достаточно ли товара на складе с учётом резервов в активных заказах.
    // Причина: иначе можно «зарезервировать» больше, чем есть физически, и UI будет вводить в заблуждение.
    const stockQuantity = await this.getStockQuantity(orderItemPart.partId, tenantId);
    const totalReservedActive = await this.getTotalReservedInActiveOrders(
      orderItemPart.partId,
      tenantId,
    );
    const reservable = stockQuantity - totalReservedActive;

    if (reservable < quantity) {
      throw new BadRequestException(
        `Невозможно зарезервировать "${quantity}" единиц товара, доступно "${reservable}"`,
      );
    }

    // Создаем резервацию
    return this.prisma.reservation.create({
      data: {
        orderItemPartId,
        quantity,
        tenantId,
      },
    });
  }

  /**
   * Снятие резерва с запчасти
   * Если quantity не указан - удаляются все резервации
   */
  async release(input: ReleaseReservationInput): Promise<number> {
    const { orderItemPartId, quantity } = input;

    if (quantity !== undefined) {
      // Частичное снятие резерва - удаляем конкретное количество
      const reservations = await this.prisma.reservation.findMany({
        where: { orderItemPartId },
        orderBy: { createdAt: 'asc' },
      });

      let remainingToRelease = quantity;
      const toDelete: string[] = [];
      const toUpdate: { id: string; newQuantity: number }[] = [];

      for (const reservation of reservations) {
        if (remainingToRelease <= 0) break;

        if (reservation.quantity <= remainingToRelease) {
          // Удаляем всю резервацию
          toDelete.push(reservation.id);
          remainingToRelease -= reservation.quantity;
        } else {
          // Уменьшаем количество в резервации
          toUpdate.push({
            id: reservation.id,
            newQuantity: reservation.quantity - remainingToRelease,
          });
          remainingToRelease = 0;
        }
      }

      // Выполняем операции
      if (toDelete.length > 0) {
        await this.prisma.reservation.deleteMany({
          where: { id: { in: toDelete } },
        });
      }

      for (const update of toUpdate) {
        await this.prisma.reservation.update({
          where: { id: update.id },
          data: { quantity: update.newQuantity },
        });
      }

      return quantity - remainingToRelease;
    } else {
      // Полное снятие резерва
      const result = await this.prisma.reservation.deleteMany({
        where: { orderItemPartId },
      });
      return result.count;
    }
  }

  /**
   * Снятие всех резерваций для элемента заказа (при удалении)
   */
  async releaseAll(orderItemPartId: string): Promise<number> {
    const result = await this.prisma.reservation.deleteMany({
      where: { orderItemPartId },
    });
    return result.count;
  }

  /**
   * Получение информации о резервациях для элемента заказа
   */
  async getByOrderItemPart(orderItemPartId: string): Promise<Reservation[]> {
    return this.prisma.reservation.findMany({
      where: { orderItemPartId },
      orderBy: { createdAt: 'asc' },
    });
  }

  /**
   * Получение общего количества зарезервированных единиц
   */
  async getTotalReserved(orderItemPartId: string): Promise<number> {
    const result = await this.prisma.reservation.aggregate({
      where: { orderItemPartId },
      _sum: { quantity: true },
    });
    return result._sum.quantity || 0;
  }

  /**
   * Проверка, есть ли резервации у элемента заказа
   */
  async hasReservations(orderItemPartId: string): Promise<boolean> {
    const count = await this.prisma.reservation.count({
      where: { orderItemPartId },
    });
    return count > 0;
  }
}
