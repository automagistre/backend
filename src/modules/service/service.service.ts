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
   * Поиск уникальных названий работ из всех заказов.
   * Причина: для автокомплита в UI без отдельного справочника работ.
   * Слова через пробел — каждое должно входить в название (AND).
   */
  async searchServices(search?: string): Promise<string[]> {
    const searchTerms = search
      ?.trim()
      .split(/\s+/)
      .filter((term) => term.length > 0);
    const where = searchTerms?.length
      ? { AND: searchTerms.map((term) => ({ service: { contains: term, mode: 'insensitive' as const } })) }
      : undefined;

    const services = await this.prisma.orderItemService.findMany({
      where,
      select: { service: true },
      distinct: ['service'],
      orderBy: { service: 'asc' },
      take: 50,
    });

    return services
      .map((s) => s.service)
      .filter((s): s is string => Boolean(s && s.trim()));
  }

  /**
   * Популярные работы (топ по частоте использования).
   * Причина: быстрый выбор без ввода и минимизация запросов.
   */
  async getPopularServices(limit = 20): Promise<string[]> {
    const result = await this.prisma.orderItemService.groupBy({
      by: ['service'],
      where: { service: { not: '' } },
      _count: { service: true },
      orderBy: { _count: { service: 'desc' } },
      take: limit,
    });

    return result.map((r) => r.service).filter((s) => Boolean(s && s.trim()));
  }

  /**
   * История выполненных работ по автомобилю, сгруппированная по заказам.
   * Основная строка: номер заказа, пробег, дата. Раскрытие: работы (название, исполнитель, цена).
   */
  async getCarServicesHistory(
    ctx: AuthContext,
    carId: string,
    search?: string,
    take = 20,
    skip = 0,
  ): Promise<PaginatedCarServices> {
    const searchTerms = search
      ?.trim()
      .split(/\s+/)
      .filter((term) => term.length > 0);
    const orderWhere = {
      carId,
      tenantId: ctx.tenantId,
      items: {
        some: {
          type: '1',
          service: searchTerms?.length
            ? {
                AND: searchTerms.map((term) => ({
                  service: { contains: term, mode: 'insensitive' as const },
                })),
              }
            : { isNot: null },
        },
      },
    };

    const [orders, total] = await this.prisma.$transaction([
      this.prisma.order.findMany({
        where: orderWhere,
        select: { id: true, number: true, status: true, mileage: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        take,
        skip,
      }),
      this.prisma.order.count({ where: orderWhere }),
    ]);

    if (orders.length === 0) {
      return { items: [], total };
    }

    const orderIds = orders.map((o) => o.id);
    const servicesWhere = {
      orderItem: {
        orderId: { in: orderIds },
        type: '1',
      },
      ...(searchTerms?.length
        ? {
            AND: searchTerms.map((term) => ({
              service: { contains: term, mode: 'insensitive' as const },
            })),
          }
        : {}),
    };

    const services = await this.prisma.orderItemService.findMany({
      where: servicesWhere,
      include: {
        orderItem: { select: { orderId: true } },
      },
    });

    const workerIds = [...new Set(services.map((i) => i.workerId).filter(Boolean))] as string[];
    const workerNamesMap = new Map<string, string>();
    for (const wid of workerIds) {
      const emp = await this.employeeService.resolveEmployeeByWorkerId(ctx, wid);
      if (emp?.person) {
        const name = [emp.person.lastname, emp.person.firstname].filter(Boolean).join(' ');
        workerNamesMap.set(wid, name || '—');
      }
    }

    const servicesByOrder = new Map<string, CarServiceHistoryItemModel[]>();
    for (const item of services) {
      const orderId = item.orderItem.orderId!;
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
      const list = servicesByOrder.get(orderId) ?? [];
      list.push(svc);
      servicesByOrder.set(orderId, list);
    }

    const items: OrderServicesGroupModel[] = orders.map((order) => ({
      orderId: order.id,
      orderNumber: order.number,
      orderStatus: order.status as OrderStatus,
      orderMileage: order.mileage,
      orderDate: order.createdAt ? order.createdAt.toISOString() : null,
      services: servicesByOrder.get(order.id) ?? [],
    }));

    return { items, total };
  }
}
