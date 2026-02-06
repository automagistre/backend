import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from 'src/generated/prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { v6 as uuidv6 } from 'uuid';
import { TenantService } from 'src/common/services/tenant.service';
import { ReservationService } from 'src/modules/reservation/reservation.service';
import { normalizeMoneyAmount } from 'src/common/utils/money.util';
import { SettingsService } from 'src/modules/settings/settings.service';
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
    private readonly settingsService: SettingsService,
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

  async findByRealization(orderItemServiceId: string) {
    return this.prisma.carRecommendation.findFirst({
      where: { realization: orderItemServiceId },
      include: { parts: true },
    });
  }

  async findById(id: string) {
    return this.prisma.carRecommendation.findUnique({
      where: { id },
      include: { parts: true },
    });
  }

  async findRecommendationPartById(id: string) {
    return this.prisma.carRecommendationPart.findUnique({
      where: { id },
      include: {
        recommendation: true,
      },
    });
  }

  async createRecommendation(
    input: CreateCarRecommendationServiceInput,
    tx?: Prisma.TransactionClient,
  ) {
    const client = tx ?? this.prisma;
    const car = await client.car.findUnique({ where: { id: input.carId } });
    if (!car) {
      throw new NotFoundException(`Автомобиль с ID ${input.carId} не найден`);
    }

    return client.carRecommendation.create({
      data: {
        id: uuidv6(),
        carId: input.carId,
        service: input.service,
        workerId: input.workerId,
        expiredAt: input.expiredAt ?? null,
        priceAmount: normalizeMoneyAmount(input.priceAmount),
        priceCurrencyCode: input.priceCurrencyCode ?? (await this.settingsService.getDefaultCurrencyCode()),
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

  async updateRecommendation(
    input: UpdateCarRecommendationServiceInput & { realization?: string | null },
    tx?: Prisma.TransactionClient,
  ) {
    const client = tx ?? this.prisma;
    const exists = await client.carRecommendation.findUnique({
      where: { id: input.id },
    });
    if (!exists) {
      throw new NotFoundException(`Рекомендация с ID ${input.id} не найдена`);
    }

    const { id, ...data } = input;

    return client.carRecommendation.update({
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

  async deleteRecommendation(id: string, tx?: Prisma.TransactionClient) {
    const client = tx ?? this.prisma;
    const exists = await client.carRecommendation.findUnique({ where: { id } });
    if (!exists) {
      throw new NotFoundException(`Рекомендация с ID ${id} не найдена`);
    }

    // Если передан внешний клиент транзакции — выполняем последовательно
    // Если нет — используем вложенную транзакцию для атомарности
    if (tx) {
      await client.carRecommendationPart.deleteMany({ where: { recommendationId: id } });
      await client.carRecommendation.delete({ where: { id } });
    } else {
      await this.prisma.$transaction([
        this.prisma.carRecommendationPart.deleteMany({ where: { recommendationId: id } }),
        this.prisma.carRecommendation.delete({ where: { id } }),
      ]);
    }

    return true;
  }

  async createRecommendationPart(
    input: CreateCarRecommendationPartServiceInput,
    tx?: Prisma.TransactionClient,
  ) {
    const client = tx ?? this.prisma;
    const rec = await client.carRecommendation.findUnique({
      where: { id: input.recommendationId },
    });
    if (!rec) {
      throw new NotFoundException(
        `Рекомендация с ID ${input.recommendationId} не найдена`,
      );
    }

    const part = await client.part.findUnique({ where: { id: input.partId } });
    if (!part) {
      throw new NotFoundException(`Запчасть с ID ${input.partId} не найдена`);
    }

    return client.carRecommendationPart.create({
      data: {
        id: uuidv6(),
        recommendationId: input.recommendationId,
        partId: input.partId,
        quantity: input.quantity,
        priceAmount: normalizeMoneyAmount(input.priceAmount),
        priceCurrencyCode: input.priceCurrencyCode ?? (await this.settingsService.getDefaultCurrencyCode()),
      },
      include: {
        part: { include: { manufacturer: true } },
      },
    });
  }

  async updateRecommendationPart(
    input: UpdateCarRecommendationPartServiceInput,
    tx?: Prisma.TransactionClient,
  ) {
    const client = tx ?? this.prisma;
    const exists = await client.carRecommendationPart.findUnique({
      where: { id: input.id },
    });
    if (!exists) {
      throw new NotFoundException(
        `Запчасть рекомендации с ID ${input.id} не найдена`,
      );
    }

    const { id, ...data } = input;

    return client.carRecommendationPart.update({
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

