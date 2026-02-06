import { Injectable } from '@nestjs/common';
import { Prisma } from 'src/generated/prisma/client';
import { PartMotionService } from './part-motion.service';
import { MotionSourceType } from './enums/motion-source-type.enum';

/** Складской модуль: списание, приёмка, резервы. */
@Injectable()
export class WarehouseService {
  constructor(
    private readonly partMotionService: PartMotionService,
  ) {}

  async getStockQuantity(partId: string): Promise<number> {
    return this.partMotionService.getStockQuantity(partId);
  }

  /**
   * Списание запчастей по закрытому заказу: снятие резервов и создание отрицательных движений.
   */
  async debitForOrder(
    tx: Prisma.TransactionClient,
    orderId: string,
    tenantId: string,
  ): Promise<void> {
    const orderItemParts = await tx.orderItemPart.findMany({
      where: { orderItem: { orderId } },
      select: { id: true, partId: true, quantity: true },
    });
    const orderItemPartIds = orderItemParts.map((p) => p.id);

    await tx.reservation.deleteMany({
      where: { tenantId, orderItemPartId: { in: orderItemPartIds } },
    });

    for (const oip of orderItemParts) {
      if (!oip.partId || oip.quantity <= 0) continue;
      await this.partMotionService.createWithinTransaction(
        tx,
        {
          partId: oip.partId,
          quantity: -oip.quantity,
          sourceType: MotionSourceType.ORDER,
          sourceId: orderId,
        },
        tenantId,
      );
    }
  }

  // TODO: приёмка от поставщика (receiveFromSupplier)
}
