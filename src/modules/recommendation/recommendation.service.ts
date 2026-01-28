import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { v6 as uuidv6 } from 'uuid';
import { TenantService } from 'src/common/services/tenant.service';
import { ReservationService } from 'src/modules/reservation/reservation.service';
import {
  normalizeMoneyAmount,
  rubCurrencyCode,
} from 'src/common/utils/money.util';
import type {
  CreateCarRecommendationPartServiceInput,
  CreateCarRecommendationServiceInput,
  UpdateCarRecommendationPartServiceInput,
  UpdateCarRecommendationServiceInput,
} from './dto/recommendation-service-inputs';

@Injectable()
export class RecommendationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantService: TenantService,
    private readonly reservationService: ReservationService,
  ) {}

  async findByCarId(carId: string) {
    const recommendations = await this.prisma.carRecommendation.findMany({
      // В старой CRM “актуальные” рекомендации определялись как те, у которых `expiredAt IS NULL`.
      // `expiredAt` выставлялся при реализации (выполнении) рекомендации.
      where: { carId, expiredAt: null },
      include: {
        parts: {
          include: {
            part: {
              include: {
                manufacturer: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    const partIds = Array.from(
      new Set(
        recommendations.flatMap((r) => r.parts.map((p) => p.partId)).filter(Boolean),
      ),
    );

    const reservedByPartId =
      partIds.length > 0
        ? await this.reservationService.getTotalReservedInActiveOrdersByPartIds(
            partIds,
            await this.tenantService.getTenantId(),
          )
        : new Map<string, number>();

    return recommendations.map((r) => ({
      ...r,
      parts: r.parts.map((p) => ({
        ...p,
        part: {
          ...p.part,
          reservedInActiveOrders: reservedByPartId.get(p.partId) ?? 0,
        },
      })),
    }));
  }

  async createRecommendation(input: CreateCarRecommendationServiceInput) {
    const car = await this.prisma.car.findUnique({ where: { id: input.carId } });
    if (!car) {
      throw new NotFoundException(`Автомобиль с ID ${input.carId} не найден`);
    }

    return this.prisma.carRecommendation.create({
      data: {
        id: uuidv6(),
        carId: input.carId,
        service: input.service,
        workerId: input.workerId,
        expiredAt: input.expiredAt ?? null,
        priceAmount: normalizeMoneyAmount(input.priceAmount),
        priceCurrencyCode: input.priceCurrencyCode ?? rubCurrencyCode(),
        // tenantGroupId / createdBy / createdAt — на уровне БД/дефолта
      },
      include: {
        parts: {
          include: {
            part: { include: { manufacturer: true } },
          },
        },
      },
    });
  }

  async updateRecommendation(input: UpdateCarRecommendationServiceInput) {
    const exists = await this.prisma.carRecommendation.findUnique({
      where: { id: input.id },
    });
    if (!exists) {
      throw new NotFoundException(`Рекомендация с ID ${input.id} не найдена`);
    }

    const { id, ...data } = input;

    return this.prisma.carRecommendation.update({
      where: { id },
      data,
      include: {
        parts: {
          include: {
            part: { include: { manufacturer: true } },
          },
        },
      },
    });
  }

  async deleteRecommendation(id: string) {
    const exists = await this.prisma.carRecommendation.findUnique({ where: { id } });
    if (!exists) {
      throw new NotFoundException(`Рекомендация с ID ${id} не найдена`);
    }

    await this.prisma.$transaction([
      this.prisma.carRecommendationPart.deleteMany({ where: { recommendationId: id } }),
      this.prisma.carRecommendation.delete({ where: { id } }),
    ]);

    return true;
  }

  async createRecommendationPart(input: CreateCarRecommendationPartServiceInput) {
    const rec = await this.prisma.carRecommendation.findUnique({
      where: { id: input.recommendationId },
    });
    if (!rec) {
      throw new NotFoundException(
        `Рекомендация с ID ${input.recommendationId} не найдена`,
      );
    }

    const part = await this.prisma.part.findUnique({ where: { id: input.partId } });
    if (!part) {
      throw new NotFoundException(`Запчасть с ID ${input.partId} не найдена`);
    }

    return this.prisma.carRecommendationPart.create({
      data: {
        id: uuidv6(),
        recommendationId: input.recommendationId,
        partId: input.partId,
        quantity: input.quantity,
        priceAmount: normalizeMoneyAmount(input.priceAmount),
        priceCurrencyCode: input.priceCurrencyCode ?? rubCurrencyCode(),
      },
      include: {
        part: { include: { manufacturer: true } },
      },
    });
  }

  async updateRecommendationPart(input: UpdateCarRecommendationPartServiceInput) {
    const exists = await this.prisma.carRecommendationPart.findUnique({
      where: { id: input.id },
    });
    if (!exists) {
      throw new NotFoundException(
        `Запчасть рекомендации с ID ${input.id} не найдена`,
      );
    }

    const { id, ...data } = input;

    return this.prisma.carRecommendationPart.update({
      where: { id },
      data,
      include: {
        part: { include: { manufacturer: true } },
      },
    });
  }

  async deleteRecommendationPart(id: string) {
    const exists = await this.prisma.carRecommendationPart.findUnique({
      where: { id },
    });
    if (!exists) {
      throw new NotFoundException(`Запчасть рекомендации с ID ${id} не найдена`);
    }

    await this.prisma.carRecommendationPart.delete({ where: { id } });
    return true;
  }
}

