import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { TenantService } from 'src/common/services/tenant.service';
import { PartSupplyService } from './part-supply.service';
import { PartMotionService } from './part-motion.service';
import { ReservationService } from 'src/modules/reservation/reservation.service';
import { ProcurementStatus } from './enums/procurement-status.enum';
import { OrderStatus } from 'src/modules/order/enums/order-status.enum';

export interface ProcurementRow {
  partId: string;
  partName: string;
  partNumber: string | null;
  manufacturerName: string | null;
  stockQuantity: number;
  inOrdersNotReserved: number;
  reservedQuantity: number;
  inSupply: number;
  needToOrder: number;
  status: ProcurementStatus;
}

const STATUS_ORDER: Record<ProcurementStatus, number> = {
  [ProcurementStatus.SUBZERO_QUANTITY]: 0,
  [ProcurementStatus.NEED_SUPPLY_FOR_ORDER]: 1,
  [ProcurementStatus.NEED_SUPPLY_FOR_STOCK]: 2,
  [ProcurementStatus.ORDERED]: 3,
};

@Injectable()
export class ProcurementService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantService: TenantService,
    private readonly partSupplyService: PartSupplyService,
    private readonly partMotionService: PartMotionService,
    private readonly reservationService: ReservationService,
  ) {}

  async getProcurementTable(params: {
    skip: number;
    take: number;
    search?: string;
  }): Promise<{ items: ProcurementRow[]; total: number }> {
    const tenantId = await this.tenantService.getTenantId();

    const candidatePartIds = await this.getCandidatePartIds(tenantId);
    if (candidatePartIds.length === 0) {
      return { items: [], total: 0 };
    }

    let where: Record<string, unknown> = { id: { in: candidatePartIds } };
    if (params.search) {
      const terms = params.search
        .trim()
        .split(/\s+/)
        .filter((t) => t.length > 0);
      if (terms.length > 0) {
        where = {
          AND: [
            { id: { in: candidatePartIds } },
            ...terms.map((term) => ({
              OR: [
                { name: { contains: term, mode: 'insensitive' as const } },
                { number: { contains: term, mode: 'insensitive' as const } },
                {
                  manufacturer: {
                    OR: [
                      { name: { contains: term, mode: 'insensitive' as const } },
                      {
                        localizedName: {
                          contains: term,
                          mode: 'insensitive' as const,
                        },
                      },
                    ],
                  },
                },
              ],
            })),
          ],
        };
      }
    }

    const parts = await this.prisma.part.findMany({
      where,
      include: { manufacturer: true },
      orderBy: [{ id: 'desc' }],
    });

    if (parts.length === 0) {
      return { items: [], total: 0 };
    }

    const partIds = parts.map((p) => p.id);
    const [stockMap, orderedMap, reservedMap, supplyMap, availabilityMap] =
      await Promise.all([
        this.partMotionService.getStockQuantityByPartIds(partIds, tenantId),
        this.partSupplyService.getOrderedQuantityInActiveOrdersByPartIds(
          partIds,
          tenantId,
        ),
        this.reservationService.getTotalReservedInActiveOrdersByPartIds(
          partIds,
          tenantId,
        ),
        this.partSupplyService.getSupplyTotalByPartIds(partIds, tenantId),
        this.getAvailabilityByPartIds(partIds, tenantId),
      ]);

    const allRows: ProcurementRow[] = [];
    for (const part of parts) {
      const stockQuantity = stockMap.get(part.id) ?? 0;
      const orderedQuantity = orderedMap.get(part.id) ?? 0;
      const reservedQuantity = reservedMap.get(part.id) ?? 0;
      const supplyQuantity = supplyMap.get(part.id) ?? 0;
      const availability = availabilityMap.get(part.id) ?? null;

      const inOrdersNotReserved = Math.max(0, orderedQuantity - reservedQuantity);
      const availableToUse = stockQuantity + supplyQuantity;
      const needForOrders = Math.max(0, orderedQuantity - availableToUse);
      let needForStock = 0;
      if (availability != null && availability.orderFrom > 0) {
        const availableForReplenishment =
          stockQuantity - orderedQuantity + supplyQuantity;
        if (
          availableForReplenishment <= availability.orderFrom &&
          availableForReplenishment <= availability.orderUpTo
        ) {
          needForStock = Math.max(
            0,
            availability.orderUpTo - availableForReplenishment,
          );
        }
      }
      const needToOrder = Math.max(needForOrders, needForStock);

      let status: ProcurementStatus;
      if (stockQuantity < 0) {
        status = ProcurementStatus.SUBZERO_QUANTITY;
      } else if (needToOrder === 0) {
        status = ProcurementStatus.ORDERED;
      } else if (needForOrders > 0) {
        status = ProcurementStatus.NEED_SUPPLY_FOR_ORDER;
      } else {
        status = ProcurementStatus.NEED_SUPPLY_FOR_STOCK;
      }

      if (supplyQuantity > 0 || needToOrder > 0) {
        allRows.push({
          partId: part.id,
          partName: part.name,
          partNumber: part.number,
          manufacturerName: part.manufacturer?.name ?? null,
          stockQuantity,
          inOrdersNotReserved,
          reservedQuantity,
          inSupply: supplyQuantity,
          needToOrder,
          status,
        });
      }
    }

    allRows.sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status]);
    const total = allRows.length;
    const items = allRows.slice(params.skip, params.skip + params.take);

    return { items, total };
  }

  private async getCandidatePartIds(tenantId: string): Promise<string[]> {
    const [fromSupply, fromOrders, fromAvailability] = await Promise.all([
      this.prisma.partSupply
        .findMany({
          where: { tenantId, quantity: { gt: 0 } },
          select: { partId: true },
          distinct: ['partId'],
        })
        .then((r) => r.map((x) => x.partId)),
      this.prisma.orderItemPart
        .findMany({
          where: {
            orderItem: {
              tenantId,
              order: { status: { notIn: [OrderStatus.CLOSED, OrderStatus.CANCELLED] } },
            },
          },
          select: { partId: true },
          distinct: ['partId'],
        })
        .then((r) => r.map((x) => x.partId)),
      this.prisma.partRequiredAvailability
        .findMany({
          where: {
            tenantId,
            NOT: {
              AND: [{ orderFromQuantity: 0 }, { orderUpToQuantity: 0 }],
            },
          },
          select: { partId: true },
          distinct: ['partId'],
        })
        .then((r) => r.map((x) => x.partId)),
    ]);
    return [...new Set([...fromSupply, ...fromOrders, ...fromAvailability])];
  }

  private async getAvailabilityByPartIds(
    partIds: string[],
    tenantId: string,
  ): Promise<Map<string, { orderFrom: number; orderUpTo: number } | null>> {
    if (partIds.length === 0) return new Map();

    const rows = await this.prisma.partRequiredAvailability.findMany({
      where: { partId: { in: partIds }, tenantId },
      orderBy: { createdAt: 'desc' },
      select: { partId: true, orderFromQuantity: true, orderUpToQuantity: true },
    });

    const result = new Map<string, { orderFrom: number; orderUpTo: number } | null>();
    for (const r of rows) {
      if (!result.has(r.partId)) {
        const isNoThreshold =
          r.orderFromQuantity === 0 && r.orderUpToQuantity === 0;
        result.set(r.partId, isNoThreshold ? null : {
          orderFrom: r.orderFromQuantity,
          orderUpTo: r.orderUpToQuantity,
        });
      }
    }
    return result;
  }

  /**
   * Заказы, в которых содержится запчасть (активные), с количеством и резервом.
   */
  async getOrdersWithPart(
    partId: string,
    tenantId?: string,
  ): Promise<
    Array<{
      orderId: string;
      orderNumber: number;
      orderStatus: OrderStatus;
      quantity: number;
      reservedQuantity: number;
      customerName: string | null;
      carName: string | null;
    }>
  > {
    const resolvedTenantId =
      tenantId ?? (await this.tenantService.getTenantId());

    const orderItemParts = await this.prisma.orderItemPart.findMany({
      where: {
        partId,
        orderItem: {
          tenantId: resolvedTenantId,
          orderId: { not: null },
          order: {
            status: {
              notIn: [OrderStatus.CLOSED, OrderStatus.CANCELLED],
            },
          },
        },
      },
      include: {
        orderItem: {
          include: {
            order: {
              include: {
                customer: true,
                car: {
                  include: {
                    vehicle: {
                      include: { manufacturer: true },
                    },
                  },
                },
              },
            },
          },
        },
        reservations: true,
      },
    });

    const byOrderId = new Map<
      string,
      {
        orderNumber: number;
        orderStatus: OrderStatus;
        quantity: number;
        reservedQuantity: number;
        customerName: string | null;
        carName: string | null;
      }
    >();

    for (const oip of orderItemParts) {
      const order = oip.orderItem?.order;
      if (!order) continue;

      const qty = oip.quantity;
      const reservedQty =
        oip.reservations?.reduce((s, r) => s + (r.quantity ?? 0), 0) ?? 0;

      const customerName =
        [order.customer?.lastname, order.customer?.firstname]
          .filter(Boolean)
          .join(' ')
          .trim() || null;

      const car = order.car as any;
      const carName =
        [car?.vehicle?.manufacturer?.name, car?.vehicle?.name, car?.vehicle?.caseName]
          .filter(Boolean)
          .join(' ')
          .trim() || null;

      const existing = byOrderId.get(order.id);
      if (existing) {
        existing.quantity += qty;
        existing.reservedQuantity += reservedQty;
      } else {
        byOrderId.set(order.id, {
          orderNumber: order.number,
          orderStatus: order.status as OrderStatus,
          quantity: qty,
          reservedQuantity: reservedQty,
          customerName,
          carName,
        });
      }
    }

    return Array.from(byOrderId.entries()).map(([orderId, v]) => ({
      orderId,
      ...v,
    }));
  }
}
