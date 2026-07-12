import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import type { AuthContext } from 'src/common/user-id.store';
import { OrderStatus } from '../order/enums/order-status.enum';
import { CarServiceHistoryItemModel } from './models/car-service-history-item.model';
import { OrderServicesGroupModel } from './models/order-services-group.model';
import { PaginatedCarServices } from './types/paginated-car-services.type';
import { DisplayContextService } from '../display-context/display-context.service';
import { RecommendationService } from '../recommendation/recommendation.service';
import { ServiceSuggestionModel } from './models/service-suggestion.model';

@Injectable()
export class ServiceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly displayContext: DisplayContextService,
    @Inject(forwardRef(() => RecommendationService))
    private readonly recommendationService: RecommendationService,
  ) {}

  private async toSuggestions(
    ctx: AuthContext,
    names: string[],
  ): Promise<ServiceSuggestionModel[]> {
    const flags = await this.recommendationService.getContractorFlagsForNames(
      ctx,
      names,
    );
    return names.map((name) => ({
      name,
      isContractor: flags.get(name) ?? false,
    }));
  }

  /**
   * Поиск уникальных названий работ из заказов тенанта.
   * Слова через пробел — каждое должно входить в название (AND).
   * Сортировка по популярности (частоте), затем по названию.
   */
  async searchServices(
    ctx: AuthContext,
    search?: string,
  ): Promise<ServiceSuggestionModel[]> {
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
        ? {
            AND: searchTerms.map((term) => ({
              service: { contains: term, mode: 'insensitive' as const },
            })),
          }
        : {}),
    };

    const result = await this.prisma.orderItemService.groupBy({
      by: ['service'],
      where,
      _count: { service: true },
      orderBy: [{ _count: { service: 'desc' } }, { service: 'asc' }],
      take: 50,
    });

    const names = result
      .map((r) => r.service)
      .filter((s): s is string => Boolean(s && s.trim()));
    return this.toSuggestions(ctx, names);
  }

  /**
   * Популярные работы (топ по частоте в закрытых заказах тенанта).
   */
  async getPopularServices(
    ctx: AuthContext,
    limit = 20,
  ): Promise<ServiceSuggestionModel[]> {
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

    const names = result
      .map((r) => r.service)
      .filter((s) => Boolean(s && s.trim())) as string[];
    return this.toSuggestions(ctx, names);
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

    const executorNamesMap = new Map<string, string>();
    for (const i of services) {
      if (!i.executorId || executorNamesMap.has(i.executorId)) continue;
      const name = await this.displayContext.getPartyDisplay(
        i.executorKind ?? 'PERSON',
        i.executorId,
      );
      if (name) executorNamesMap.set(i.executorId, name);
    }

    type OrderInfo = {
      id: string;
      number: number;
      status: OrderStatus;
      mileage: number | null;
      createdAt: Date | null;
    };
    const servicesByOrder = new Map<
      string,
      { order: OrderInfo; items: CarServiceHistoryItemModel[] }
    >();
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
        executorName: item.executorId
          ? (executorNamesMap.get(item.executorId) ?? null)
          : null,
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

    const items: OrderServicesGroupModel[] = [...servicesByOrder.values()].map(
      (entry) => ({
        orderId: entry.order.id,
        orderNumber: entry.order.number,
        orderStatus: entry.order.status,
        orderMileage: entry.order.mileage,
        orderDate: entry.order.createdAt
          ? entry.order.createdAt.toISOString()
          : null,
        services: entry.items,
      }),
    );

    return { items, total };
  }
}
