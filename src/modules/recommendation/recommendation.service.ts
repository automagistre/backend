import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  forwardRef,
} from '@nestjs/common';
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
import { AuditLogService } from 'src/modules/audit-log/audit-log.service';
import { AuditEntityType } from 'src/modules/audit-log/enums/audit.enums';
import { DisplayContextService } from 'src/modules/display-context/display-context.service';

@Injectable()
export class RecommendationService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => ReservationService))
    private readonly reservationService: ReservationService,
    private readonly settingsService: SettingsService,
    private readonly auditLog: AuditLogService,
    private readonly displayContext: DisplayContextService,
  ) {}

  /** Аудит рекомендации с маршрутизацией в root=CAR (если carId известен). */
  private async auditRecommendation(
    client: Prisma.TransactionClient | PrismaService,
    ctx: AuthContext,
    carId: string | null,
    recommendationId: string,
    before: Record<string, any> | null,
    after: Record<string, any> | null,
    serviceName: string | null,
  ): Promise<void> {
    if (!carId) return;
    await this.auditLog.record(client, ctx, {
      rootEntityType: AuditEntityType.CAR,
      rootEntityId: carId,
      entityType: AuditEntityType.CAR_RECOMMENDATION,
      entityId: recommendationId,
      before,
      after,
      entityDisplayName: serviceName,
    });
  }

  /** Аудит запчасти рекомендации с маршрутизацией в root=CAR. */
  private async auditRecommendationPart(
    client: Prisma.TransactionClient | PrismaService,
    ctx: AuthContext,
    carId: string | null,
    partRowId: string,
    partId: string | null,
    before: Record<string, any> | null,
    after: Record<string, any> | null,
  ): Promise<void> {
    if (!carId) return;
    await this.auditLog.record(client, ctx, {
      rootEntityType: AuditEntityType.CAR,
      rootEntityId: carId,
      entityType: AuditEntityType.CAR_RECOMMENDATION_PART,
      entityId: partRowId,
      before,
      after,
      entityDisplayName: partId
        ? await this.displayContext.getPartName(partId)
        : null,
    });
  }

  /**
   * Read-only без ReservationService и parts: используется клиентским API
   * (LK) — рекомендации актуальные на сейчас. «Активные» = `expiredAt is
   * null OR expiredAt > now()`.
   */
  async findActiveByCarIdInTenantGroup(tenantGroupId: string, carId: string) {
    return this.prisma.carRecommendation.findMany({
      where: {
        carId,
        tenantGroupId,
        OR: [{ expiredAt: null }, { expiredAt: { gt: new Date() } }],
      },
      orderBy: { createdAt: 'desc' },
    });
  }

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
        recommendations
          .flatMap((r) => r.parts.map((p) => p.partId))
          .filter(Boolean),
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
      where: {
        realization: orderItemServiceId,
        tenantGroupId: ctx.tenantGroupId,
      },
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

  /**
   * Диагност — всегда персона (реальный человек, который порекомендовал).
   * При сторонней диагностике (не нами) диагност пуст.
   * Подрядчик хранится отдельно и допустим только у подрядной рекомендации.
   */
  private validateRoles(fields: {
    kind: string;
    executorKind: string | null;
    contractorKind: string | null;
    contractorId: string | null;
    externalDiagnostic: boolean;
  }): void {
    if (fields.executorKind === 'ORGANIZATION') {
      throw new BadRequestException(
        'Диагностом может быть только человек — сторонняя диагностика отмечается флагом',
      );
    }
    if (fields.externalDiagnostic && fields.executorKind != null) {
      throw new BadRequestException(
        'При сторонней диагностике диагност не указывается',
      );
    }
    if (
      fields.kind !== 'CONTRACTOR' &&
      (fields.contractorKind != null || fields.contractorId != null)
    ) {
      throw new BadRequestException(
        'Подрядчик доступен только для подрядной рекомендации',
      );
    }
  }

  async createRecommendation(
    ctx: AuthContext,
    input: CreateCarRecommendationServiceInput,
    tx?: Prisma.TransactionClient,
    audit = true,
  ) {
    const client = tx ?? this.prisma;
    const car = await client.car.findFirst({
      where: { id: input.carId, tenantGroupId: ctx.tenantGroupId },
    });
    if (!car) {
      throw new NotFoundException(`Автомобиль с ID ${input.carId} не найден`);
    }

    const kind = input.kind ?? 'AUTOSERVICE';
    const externalDiagnostic = input.externalDiagnostic ?? false;
    // Сторонняя диагностика: диагност не хранится
    const executorKind = externalDiagnostic ? null : input.executorKind;
    const executorId = externalDiagnostic ? null : input.executorId;
    this.validateRoles({
      kind,
      executorKind,
      contractorKind: input.contractorKind ?? null,
      contractorId: input.contractorId ?? null,
      externalDiagnostic,
    });

    const created = await client.carRecommendation.create({
      data: {
        id: uuidv6(),
        carId: input.carId,
        service: input.service,
        kind,
        executorKind,
        executorId,
        externalDiagnostic,
        contractorKind: input.contractorKind ?? null,
        contractorId: input.contractorId ?? null,
        expiredAt: input.expiredAt ?? null,
        priceAmount: normalizeMoneyAmount(input.priceAmount),
        priceCurrencyCode:
          input.priceCurrencyCode ??
          (await this.settingsService.getDefaultCurrencyCode()),
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

    if (audit) {
      await this.auditRecommendation(
        client,
        ctx,
        created.carId,
        created.id,
        null,
        created,
        created.service,
      );
    }

    return created;
  }

  async updateRecommendation(
    ctx: AuthContext,
    input: UpdateCarRecommendationServiceInput & {
      realization?: string | null;
    },
    tx?: Prisma.TransactionClient,
    audit = true,
  ) {
    const client = tx ?? this.prisma;
    const exists = await client.carRecommendation.findFirst({
      where: { id: input.id, tenantGroupId: ctx.tenantGroupId },
    });
    if (!exists) {
      throw new NotFoundException(`Рекомендация с ID ${input.id} не найдена`);
    }

    const { id, ...data } = input;

    // Итоговое состояние после апдейта: перевод в свою работу очищает подрядчика
    const effective = { ...exists, ...data };
    if (effective.kind !== 'CONTRACTOR') {
      if (effective.contractorKind != null || effective.contractorId != null) {
        data.contractorKind = null;
        data.contractorId = null;
        effective.contractorKind = null;
        effective.contractorId = null;
      }
    }
    // Сторонняя диагностика и диагност взаимоисключающие:
    // включение флага очищает диагноста, назначение диагноста снимает флаг.
    if (data.externalDiagnostic === true) {
      data.executorKind = null;
      data.executorId = null;
      effective.executorKind = null;
      effective.executorId = null;
    } else if (
      data.externalDiagnostic == null &&
      data.executorKind != null &&
      effective.externalDiagnostic
    ) {
      data.externalDiagnostic = false;
      effective.externalDiagnostic = false;
    }
    this.validateRoles({
      kind: effective.kind,
      executorKind: effective.executorKind,
      contractorKind: effective.contractorKind,
      contractorId: effective.contractorId,
      externalDiagnostic: effective.externalDiagnostic,
    });

    const updated = await client.carRecommendation.update({
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

    if (audit) {
      await this.auditRecommendation(
        client,
        ctx,
        updated.carId,
        updated.id,
        exists,
        updated,
        updated.service,
      );
    }

    return updated;
  }

  async deleteRecommendation(
    ctx: AuthContext,
    id: string,
    tx?: Prisma.TransactionClient,
    audit = true,
  ) {
    const client = tx ?? this.prisma;
    const exists = await client.carRecommendation.findFirst({
      where: { id, tenantGroupId: ctx.tenantGroupId },
    });
    if (!exists) {
      throw new NotFoundException(`Рекомендация с ID ${id} не найдена`);
    }

    if (tx) {
      await client.carRecommendationPart.deleteMany({
        where: { recommendationId: id },
      });
      await client.carRecommendation.delete({ where: { id } });
    } else {
      await this.prisma.$transaction([
        this.prisma.carRecommendationPart.deleteMany({
          where: { recommendationId: id },
        }),
        this.prisma.carRecommendation.delete({ where: { id } }),
      ]);
    }

    if (audit) {
      await this.auditRecommendation(
        client,
        ctx,
        exists.carId,
        id,
        exists,
        null,
        exists.service,
      );
    }

    return true;
  }

  async createRecommendationPart(
    ctx: AuthContext,
    input: CreateCarRecommendationPartServiceInput,
    tx?: Prisma.TransactionClient,
    audit = true,
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

    const created = await client.carRecommendationPart.create({
      data: {
        id: uuidv6(),
        recommendationId: input.recommendationId,
        partId: input.partId,
        quantity: input.quantity,
        priceAmount: normalizeMoneyAmount(input.priceAmount),
        priceCurrencyCode:
          input.priceCurrencyCode ??
          (await this.settingsService.getDefaultCurrencyCode()),
        tenantGroupId: ctx.tenantGroupId,
        createdBy: ctx.userId,
      },
      include: {
        part: { include: { manufacturer: true } },
      },
    });

    if (audit) {
      await this.auditRecommendationPart(
        client,
        ctx,
        rec.carId,
        created.id,
        created.partId,
        null,
        created,
      );
    }

    return created;
  }

  async updateRecommendationPart(
    ctx: AuthContext,
    input: UpdateCarRecommendationPartServiceInput,
    tx?: Prisma.TransactionClient,
    audit = true,
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

    if (input.partId !== undefined) {
      const part = await client.part.findUnique({
        where: { id: input.partId },
        select: { id: true },
      });
      if (!part) {
        throw new NotFoundException(`Запчасть с ID ${input.partId} не найдена`);
      }
    }

    const { id, ...data } = input;

    const updated = await client.carRecommendationPart.update({
      where: { id },
      data,
      include: {
        part: { include: { manufacturer: true } },
      },
    });

    if (audit) {
      const carId = await this.resolveRecommendationCarId(
        client,
        exists.recommendationId,
      );
      await this.auditRecommendationPart(
        client,
        ctx,
        carId,
        updated.id,
        updated.partId,
        exists,
        updated,
      );
    }

    return updated;
  }

  async deleteRecommendationPart(ctx: AuthContext, id: string) {
    const exists = await this.prisma.carRecommendationPart.findFirst({
      where: { id, tenantGroupId: ctx.tenantGroupId },
    });
    if (!exists) {
      throw new NotFoundException(
        `Запчасть рекомендации с ID ${id} не найдена`,
      );
    }

    const carId = await this.resolveRecommendationCarId(
      this.prisma,
      exists.recommendationId,
    );
    await this.prisma.carRecommendationPart.delete({ where: { id } });

    await this.auditRecommendationPart(
      this.prisma,
      ctx,
      carId,
      exists.id,
      exists.partId,
      exists,
      null,
    );

    return true;
  }

  private async resolveRecommendationCarId(
    client: Prisma.TransactionClient | PrismaService,
    recommendationId: string,
  ): Promise<string | null> {
    const rec = await client.carRecommendation.findUnique({
      where: { id: recommendationId },
      select: { carId: true },
    });
    return rec?.carId ?? null;
  }
}
