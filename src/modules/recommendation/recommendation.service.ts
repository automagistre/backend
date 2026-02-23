import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from 'src/generated/prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { v6 as uuidv6 } from 'uuid';
import { ReservationService } from 'src/modules/reservation/reservation.service';
import { normalizeMoneyAmount } from 'src/common/utils/money.util';
import { SettingsService } from 'src/modules/settings/settings.service';
import type {
  CreateCarRecommendationPartServiceInput,
  CreateCarRecommendationServiceInput,
  UpdateCarRecommendationPartServiceInput,
  UpdateCarRecommendationServiceInput,
} from './dto/recommendation-service-inputs';
import type { AuthContext } from 'src/common/user-id.store';

@Injectable()
export class RecommendationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reservationService: ReservationService,
    private readonly settingsService: SettingsService,
  ) {}

  async findByCarId(ctx: AuthContext, carId: string) {
    const recommendations = await this.prisma.carRecommendation.findMany({
      where: { carId, tenantGroupId: ctx.tenantGroupId, expiredAt: null },
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
            ctx.tenantId,
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

  async findByRealization(ctx: AuthContext, orderItemServiceId: string) {
    return this.prisma.carRecommendation.findFirst({
      where: { realization: orderItemServiceId, tenantGroupId: ctx.tenantGroupId },
      include: { parts: true },
    });
  }

  async findById(ctx: AuthContext, id: string) {
    return this.prisma.carRecommendation.findFirst({
      where: { id, tenantGroupId: ctx.tenantGroupId },
      include: { parts: true },
    });
  }

  async findRecommendationPartById(ctx: AuthContext, id: string) {
    return this.prisma.carRecommendationPart.findFirst({
      where: { id, tenantGroupId: ctx.tenantGroupId },
      include: {
        recommendation: true,
      },
    });
  }

  async createRecommendation(
    ctx: AuthContext,
    input: CreateCarRecommendationServiceInput,
    tx?: Prisma.TransactionClient,
  ) {
    const client = tx ?? this.prisma;
    const car = await client.car.findFirst({
      where: { id: input.carId, tenantGroupId: ctx.tenantGroupId },
    });
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
        tenantGroupId: ctx.tenantGroupId,
        createdBy: ctx.userId,
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
    ctx: AuthContext,
    input: UpdateCarRecommendationServiceInput & { realization?: string | null },
    tx?: Prisma.TransactionClient,
  ) {
    const client = tx ?? this.prisma;
    const exists = await client.carRecommendation.findFirst({
      where: { id: input.id, tenantGroupId: ctx.tenantGroupId },
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

  async deleteRecommendation(ctx: AuthContext, id: string, tx?: Prisma.TransactionClient) {
    const client = tx ?? this.prisma;
    const exists = await client.carRecommendation.findFirst({
      where: { id, tenantGroupId: ctx.tenantGroupId },
    });
    if (!exists) {
      throw new NotFoundException(`Рекомендация с ID ${id} не найдена`);
    }

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
    ctx: AuthContext,
    input: CreateCarRecommendationPartServiceInput,
    tx?: Prisma.TransactionClient,
  ) {
    const client = tx ?? this.prisma;
    const rec = await client.carRecommendation.findFirst({
      where: { id: input.recommendationId, tenantGroupId: ctx.tenantGroupId },
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
        tenantGroupId: ctx.tenantGroupId,
        createdBy: ctx.userId,
      },
      include: {
        part: { include: { manufacturer: true } },
      },
    });
  }

  async updateRecommendationPart(
    ctx: AuthContext,
    input: UpdateCarRecommendationPartServiceInput,
    tx?: Prisma.TransactionClient,
  ) {
    const client = tx ?? this.prisma;
    const exists = await client.carRecommendationPart.findFirst({
      where: { id: input.id, tenantGroupId: ctx.tenantGroupId },
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

  async deleteRecommendationPart(ctx: AuthContext, id: string) {
    const exists = await this.prisma.carRecommendationPart.findFirst({
      where: { id, tenantGroupId: ctx.tenantGroupId },
    });
    if (!exists) {
      throw new NotFoundException(`Запчасть рекомендации с ID ${id} не найдена`);
    }

    await this.prisma.carRecommendationPart.delete({ where: { id } });
    return true;
  }
}
