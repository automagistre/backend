import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { Reservation } from 'src/generated/prisma/client';

export interface ReservePartInput {
  orderItemPartId: string;
  quantity: number;
  tenantId: string;
}

export interface ReleaseReservationInput {
  orderItemPartId: string;
  quantity?: number; // Если не указано - снимаем весь резерв
}

@Injectable()
export class ReservationService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Резервирование запчасти для элемента заказа
   */
  async reserve(input: ReservePartInput): Promise<Reservation> {
    const { orderItemPartId, quantity, tenantId } = input;

    if (quantity <= 0) {
      throw new BadRequestException('Количество для резервирования должно быть больше 0');
    }

    // Проверяем существование order_item_part
    const orderItemPart = await this.prisma.orderItemPart.findUnique({
      where: { id: orderItemPartId },
      include: { part: true },
    });

    if (!orderItemPart) {
      throw new BadRequestException(`Элемент заказа с ID ${orderItemPartId} не найден`);
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
