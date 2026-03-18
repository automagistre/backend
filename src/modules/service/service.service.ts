import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import type { AuthContext } from 'src/common/user-id.store';
import { OrderStatus } from '../order/enums/order-status.enum';
import { CarServiceHistoryItemModel } from './models/car-service-history-item.model';
import { OrderServicesGroupModel } from './models/order-services-group.model';
import { PaginatedCarServices } from './types/paginated-car-services.type';
import { EmployeeService } from '../employee/employee.service';

@Injectable()
export class ServiceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly employeeService: EmployeeService,
  ) {}

  /**
   * Поиск уникальных названий работ из заказов тенанта.
   * Слова через пробел — каждое должно входить в название (AND).
   * Сортировка по популярности (частоте), затем по названию.
   */
  async searchServices(
    ctx: AuthContext,
    search?: string,
  ): Promise<string[]> {
    const searchTerms = search
      ?.trim()
      .split(/\s+/)
      .filter((term) => term.length > 0);
    const where = {
      service: { not: '' },
      orderItem: {
        tenantId: ctx.tenantId,
        order: { status: OrderStatus.CLOSED },
      },
      ...(searchTerms?.length
        ? { AND: searchTerms.map((term) => ({ service: { contains: term, mode: 'insensitive' as const } })) }
        : {}),
    };

    const result = await this.prisma.orderItemService.groupBy({
      by: ['service'],
      where,
      _count: { service: true },
      orderBy: [
        { _count: { service: 'desc' } },
        { service: 'asc' },
      ],
      take: 50,
    });

    return result
      .map((r) => r.service)
      .filter((s): s is string => Boolean(s && s.trim()));
  }

  /**
   * Популярные работы (топ по частоте в закрытых заказах тенанта).
   */
  async getPopularServices(ctx: AuthContext, limit = 20): Promise<string[]> {
    const result = await this.prisma.orderItemService.groupBy({
      by: ['service'],
      where: {
        service: { not: '' },
        orderItem: {
          tenantId: ctx.tenantId,
          order: { status: OrderStatus.CLOSED },
        },
      },
      _count: { service: true },
      orderBy: { _count: { service: 'desc' } },
      take: limit,
    });

    return result.map((r) => r.service).filter((s) => Boolean(s && s.trim()));
  }

  /**
   * История выполненных работ по автомобилю, сгруппированная по заказам.
   * Пагинация по работам: take/skip — число работ, total — общее число работ.
   */
  async getCarServicesHistory(
    ctx: AuthContext,
    carId: string,
    search?: string,
    take = 50,
    skip = 0,
  ): Promise<PaginatedCarServices> {
    const searchTerms = search
      ?.trim()
      .split(/\s+/)
      .filter((term) => term.length > 0);

    const servicesWhere = {
      orderItem: {
        type: '1',
        order: {
          carId,
          tenantId: ctx.tenantId,
          status: OrderStatus.CLOSED,
        },
      },
      ...(searchTerms?.length
        ? {
            AND: searchTerms.map((term) => ({
              service: { contains: term, mode: 'insensitive' as const },
            })),
          }
        : {}),
    };

    const [services, total] = await this.prisma.$transaction([
      this.prisma.orderItemService.findMany({
        where: servicesWhere,
        skip,
        take,
        orderBy: [
          { orderItem: { order: { createdAt: 'desc' } } },
          { id: 'asc' },
        ],
        include: {
          orderItem: {
            select: {
              orderId: true,
              order: {
                select: {
                  id: true,
                  number: true,
                  status: true,
                  mileage: true,
                  createdAt: true,
                },
              },
            },
          },
        },
      }),
      this.prisma.orderItemService.count({ where: servicesWhere }),
    ]);

    if (services.length === 0) {
      return { items: [], total };
    }

    const workerIds = [...new Set(services.map((i) => i.workerId).filter(Boolean))] as string[];
    const workerNamesMap = new Map<string, string>();
    for (const wid of workerIds) {
      const emp = await this.employeeService.resolveEmployeeByWorkerId(ctx, wid);
      if (emp?.person) {
        const name = [emp.person.lastname, emp.person.firstname].filter(Boolean).join(' ');
        workerNamesMap.set(wid, name || '—');
      }
    }

    type OrderInfo = { id: string; number: number; status: OrderStatus; mileage: number | null; createdAt: Date | null };
    const servicesByOrder = new Map<string, { order: OrderInfo; items: CarServiceHistoryItemModel[] }>();
    for (const item of services) {
      const order = item.orderItem.order!;
      const orderId = order.id;
      const priceAmount = item.priceAmount ?? 0n;
      const discountAmount = item.discountAmount ?? 0n;
      const finalAmount = priceAmount - discountAmount;
      const svc: CarServiceHistoryItemModel = {
        id: item.id,
        service: item.service,
        price:
          finalAmount >= 0n
            ? {
                amountMinor: finalAmount,
                currencyCode: item.priceCurrencyCode ?? 'RUB',
              }
            : null,
        executorName: item.workerId ? workerNamesMap.get(item.workerId) ?? null : null,
      };
      const entry = servicesByOrder.get(orderId);
      if (entry) {
        entry.items.push(svc);
      } else {
        servicesByOrder.set(orderId, {
          order: {
            id: order.id,
            number: order.number,
            status: order.status as OrderStatus,
            mileage: order.mileage,
            createdAt: order.createdAt,
          },
          items: [svc],
        });
      }
    }

    const items: OrderServicesGroupModel[] = [...servicesByOrder.values()].map((entry) => ({
      orderId: entry.order.id,
      orderNumber: entry.order.number,
      orderStatus: entry.order.status,
      orderMileage: entry.order.mileage,
      orderDate: entry.order.createdAt ? entry.order.createdAt.toISOString() : null,
      services: entry.items,
    }));

    return { items, total };
  }
}
