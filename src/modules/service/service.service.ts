import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class ServiceService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Поиск уникальных названий работ из всех заказов.
   * Причина: для автокомплита в UI без отдельного справочника работ.
   */
  async searchServices(search?: string): Promise<string[]> {
    const where = search
      ? { service: { contains: search, mode: 'insensitive' as const } }
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
}
