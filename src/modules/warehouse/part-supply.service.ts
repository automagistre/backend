import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { TenantService } from 'src/common/services/tenant.service';
import { SupplySource } from 'src/modules/part/enums/supply-source.enum';
import { OrderStatus } from 'src/modules/order/enums/order-status.enum';

export interface SupplyBySupplier {
  supplierId: string;
  quantity: number;
  updatedAt: Date;
}

@Injectable()
export class PartSupplyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantService: TenantService,
  ) {}

  /**
   * Сумма ожидаемых поставок по запчасти (ledger: SUM всех записей, при оприходовании добавляется -quantity).
   */
  async getSupplyTotalByPart(
    partId: string,
    tenantId?: string,
  ): Promise<number> {
    const resolvedTenantId = tenantId ?? (await this.tenantService.getTenantId());
    const result = await this.prisma.partSupply.aggregate({
      where: {
        partId,
        tenantId: resolvedTenantId,
      },
      _sum: { quantity: true },
    });
    const sum = result._sum.quantity ?? 0;
    return sum > 0 ? sum : 0;
  }

  /**
   * partId, у которых есть хотя бы одна поставка с max(createdAt) < (now - expiryDays).
   */
  async getPartIdsWithDelayedSupply(
    partIds: string[],
    expiryDays: number,
    tenantId?: string,
  ): Promise<Set<string>> {
    const resolvedTenantId = tenantId ?? (await this.tenantService.getTenantId());
    if (partIds.length === 0 || expiryDays <= 0) return new Set();

    const threshold = new Date();
    threshold.setDate(threshold.getDate() - expiryDays);

    const rows = await this.prisma.partSupply.groupBy({
      by: ['partId', 'supplierId'],
      where: {
        partId: { in: partIds },
        tenantId: resolvedTenantId,
      },
      _sum: { quantity: true },
      _max: { createdAt: true },
    });

    const delayed = new Set<string>();
    for (const r of rows) {
      const sum = r._sum.quantity ?? 0;
      const maxCreated = r._max.createdAt;
      if (sum > 0 && maxCreated != null && maxCreated < threshold) {
        delayed.add(r.partId);
      }
    }
    return delayed;
  }

  /**
   * Батч: сумма ожидаемых поставок по списку запчастей (ledger: SUM всех записей).
   */
  async getSupplyTotalByPartIds(
    partIds: string[],
    tenantId?: string,
  ): Promise<Map<string, number>> {
    const resolvedTenantId = tenantId ?? (await this.tenantService.getTenantId());
    if (partIds.length === 0) return new Map();

    const rows = await this.prisma.partSupply.groupBy({
      by: ['partId'],
      where: {
        partId: { in: partIds },
        tenantId: resolvedTenantId,
      },
      _sum: { quantity: true },
    });

    const result = new Map<string, number>();
    for (const r of rows) {
      const sum = r._sum.quantity ?? 0;
      if (sum > 0) {
        result.set(r.partId, sum);
      }
    }
    return result;
  }

  /**
   * Список поставок по запчасти (ledger: SUM по part+supplier, только где баланс > 0).
   */
  async getSuppliesByPart(
    partId: string,
    tenantId?: string,
  ): Promise<SupplyBySupplier[]> {
    const resolvedTenantId = tenantId ?? (await this.tenantService.getTenantId());
    const rows = await this.prisma.partSupply.groupBy({
      by: ['partId', 'supplierId'],
      where: {
        partId,
        tenantId: resolvedTenantId,
      },
      _sum: { quantity: true },
      _max: { createdAt: true },
    });

    return rows
      .filter((r) => (r._sum.quantity ?? 0) > 0)
      .map((r) => ({
        supplierId: r.supplierId,
        quantity: r._sum.quantity ?? 0,
        updatedAt: r._max.createdAt ?? new Date(),
      }));
  }

  /**
   * Отмена поставки (добавляет -quantity в ledger).
   */
  async cancelPartSupply(
    partId: string,
    supplierId: string,
    quantity: number,
  ): Promise<void> {
    if (quantity <= 0) {
      throw new BadRequestException('Количество должно быть больше 0');
    }
    const tenantId = await this.tenantService.getTenantId();
    await this.prisma.partSupply.create({
      data: {
        partId,
        supplierId,
        quantity: -quantity,
        source: SupplySource.MANUAL,
        sourceId: crypto.randomUUID(),
        tenantId,
      },
    });
  }

  /**
   * Создание ручной поставки.
   */
  async createPartSupply(
    partId: string,
    supplierId: string,
    quantity: number,
  ): Promise<{ id: string; partId: string; supplierId: string; quantity: number }> {
    if (quantity <= 0) {
      throw new BadRequestException('Количество должно быть больше 0');
    }
    const tenantId = await this.tenantService.getTenantId();
    const supply = await this.prisma.partSupply.create({
      data: {
        partId,
        supplierId,
        quantity,
        source: SupplySource.MANUAL,
        sourceId: crypto.randomUUID(),
        tenantId,
      },
    });
    return {
      id: supply.id,
      partId: supply.partId,
      supplierId: supply.supplierId,
      quantity: supply.quantity,
    };
  }

  /**
   * Сумма OrderItemPart.quantity по запчасти в активных заказах (не CLOSED, не CANCELLED).
   */
  async getOrderedQuantityInActiveOrders(
    partId: string,
    tenantId?: string,
  ): Promise<number> {
    const resolvedTenantId = tenantId ?? (await this.tenantService.getTenantId());
    const result = await this.prisma.orderItemPart.aggregate({
      where: {
        partId,
        orderItem: {
          tenantId: resolvedTenantId,
          order: {
            status: {
              notIn: [OrderStatus.CLOSED, OrderStatus.CANCELLED],
            },
          },
        },
      },
      _sum: { quantity: true },
    });
    return result._sum.quantity ?? 0;
  }

  /**
   * Батч: сумма заказанного количества в активных заказах по списку запчастей.
   */
  async getOrderedQuantityInActiveOrdersByPartIds(
    partIds: string[],
    tenantId?: string,
  ): Promise<Map<string, number>> {
    const resolvedTenantId = tenantId ?? (await this.tenantService.getTenantId());
    if (partIds.length === 0) return new Map();

    const rows = await this.prisma.orderItemPart.groupBy({
      by: ['partId'],
      where: {
        partId: { in: partIds },
        orderItem: {
          tenantId: resolvedTenantId,
          order: {
            status: {
              notIn: [OrderStatus.CLOSED, OrderStatus.CANCELLED],
            },
          },
        },
      },
      _sum: { quantity: true },
    });

    const result = new Map<string, number>();
    for (const r of rows) {
      result.set(r.partId, r._sum.quantity ?? 0);
    }
    return result;
  }
}
