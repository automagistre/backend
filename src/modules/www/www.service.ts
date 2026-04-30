import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from 'src/generated/prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { v6 as uuidv6 } from 'uuid';
import { SYSTEM_USER_ID } from 'src/common/user-id.store';
import type { WwwStats } from './models/www-stats.model';
import type {
  WwwReviewConnection,
  WwwReview,
} from './models/www-review.model';
import type { WwwVehicle } from './models/www-vehicle.model';
import type { WwwMaintenance } from './models/www-maintenance.model';
import type {
  WwwCreateAppealCalculatorInput,
  WwwCreateAppealCallInput,
  WwwCreateAppealCooperationInput,
  WwwCreateAppealQuestionInput,
  WwwCreateAppealScheduleInput,
  WwwCreateAppealTireFittingInput,
} from './inputs/create-appeal.inputs';
import { TIRE_FITTING_CATEGORY_TO_INT } from './enums/tire-fitting-category.enum';
import type { WwwTenantContext } from './decorators/www-tenant.decorator';

const RFC3339 = (d: Date): string => d.toISOString();

const REVIEW_SOURCE_NAME: Record<number, string> = {
  1: 'club',
  2: 'yandex',
  3: 'google',
  4: 'two_gis',
  5: 'yell',
};

const FUEL_TYPE_NAME: Record<number, string> = {
  1: 'petrol',
  2: 'diesel',
  3: 'ethanol',
  4: 'electric',
  5: 'hybrid',
};

const AIR_INTAKE_NAME: Record<number, string> = {
  1: 'atmo',
  2: 'turbo',
};

const INJECTION_NAME: Record<number, string> = {
  1: 'classic',
  2: 'direct',
};

const TRANSMISSION_NAME: Record<number, string> = {
  1: 'AT',
  2: 'AMT',
  3: 'CVT',
  4: 'MT',
  5: 'AT5',
  6: 'AT7',
};

const WHEEL_DRIVE_NAME: Record<number, string> = {
  1: 'FWD',
  2: 'RWD',
  3: 'AWD',
};

@Injectable()
export class WwwService {
  constructor(private readonly prisma: PrismaService) {}

  // ──────────────────────────────────────────────────────────────────────
  // Queries
  // ──────────────────────────────────────────────────────────────────────

  /**
   * Статистика для главной www: количество заказов / авто / клиентов / отзывов.
   * Аналог QueryType.stats из legacy CRM (App\Site\QueryType).
   */
  async getStats(ctx: WwwTenantContext): Promise<WwwStats> {
    const { tenantId } = ctx;
    const [stats] = await this.prisma.$queryRaw<
      Array<{
        orders: bigint;
        vehicles: bigint;
        organizations: bigint;
        persons: bigint;
        reviews: bigint;
      }>
    >(Prisma.sql`
      SELECT
        (SELECT COUNT(*)::bigint FROM orders WHERE tenant_id = ${tenantId}::uuid) AS orders,
        (SELECT COUNT(DISTINCT car_id)::bigint FROM orders WHERE tenant_id = ${tenantId}::uuid AND car_id IS NOT NULL) AS vehicles,
        (SELECT COUNT(DISTINCT o.customer_id)::bigint
           FROM orders o JOIN organization org ON org.id = o.customer_id
           WHERE o.tenant_id = ${tenantId}::uuid) AS organizations,
        (SELECT COUNT(DISTINCT o.customer_id)::bigint
           FROM orders o JOIN person p ON p.id = o.customer_id
           WHERE o.tenant_id = ${tenantId}::uuid) AS persons,
        (SELECT COUNT(*)::bigint FROM review WHERE tenant_id = ${tenantId}::uuid AND text <> '') AS reviews
    `);

    return {
      orders: Number(stats?.orders ?? 0),
      vehicles: Number(stats?.vehicles ?? 0),
      customers: {
        persons: Number(stats?.persons ?? 0),
        organizations: Number(stats?.organizations ?? 0),
      },
      reviews: Number(stats?.reviews ?? 0),
    };
  }

  /**
   * Постранично отзывы (cursor-based по publishAt DESC).
   * Cursor — base64(RFC3339 publishAt), чтобы было совместимо с legacy CRM.
   */
  async getReviews(
    ctx: WwwTenantContext,
    first: number,
    after: string | null,
  ): Promise<WwwReviewConnection> {
    const { tenantId } = ctx;
    const limit = Math.max(1, Math.min(first || 10, 100));

    let afterDate: Date | undefined;
    if (after) {
      const decoded = Buffer.from(after, 'base64').toString('utf8');
      const parsed = new Date(decoded);
      if (Number.isNaN(parsed.getTime())) {
        throw new Error('Invalid after cursor');
      }
      afterDate = parsed;
    }

    const where = {
      tenantId,
      text: { not: '' },
      ...(afterDate ? { publishAt: { lte: afterDate } } : {}),
    };

    const [rows, totalCount] = await Promise.all([
      this.prisma.review.findMany({
        where,
        take: limit + 1,
        orderBy: { publishAt: 'desc' as const },
      }),
      this.prisma.review.count({ where: { tenantId, text: { not: '' } } }),
    ]);

    const hasNextPage = rows.length > limit;
    const nodesRaw = hasNextPage ? rows.slice(0, limit) : rows;
    const cursorSource = hasNextPage ? rows[limit] : undefined;

    const nodes: WwwReview[] = nodesRaw.map((r) => ({
      id: r.id,
      author: r.author,
      text: r.text,
      source: REVIEW_SOURCE_NAME[r.source] ?? 'club',
      publishAt: r.publishAt,
    }));

    const endCursor = cursorSource
      ? Buffer.from(RFC3339(cursorSource.publishAt)).toString('base64')
      : null;

    return {
      nodes,
      pageInfo: { endCursor, hasNextPage },
      totalCount,
    };
  }

  /**
   * Карточка одного автомобиля по ID.
   * Аналог QueryType.vehicle(id).
   */
  async getVehicle(_ctx: WwwTenantContext, id: string): Promise<WwwVehicle> {
    const vehicle = await this.prisma.vehicle.findFirst({
      where: { id },
      include: { manufacturer: true },
    });
    if (!vehicle) throw new NotFoundException('Vehicle not found');
    return mapVehicle(vehicle);
  }

  /**
   * Список автомобилей конкретного производителя, для которых есть опубликованные ТО.
   * publish_view хранит тенанта в записях — фильтруем по нему.
   */
  async getVehiclesByManufacturer(
    ctx: WwwTenantContext,
    manufacturerId: string,
  ): Promise<WwwVehicle[]> {
    const { tenantId } = ctx;
    const rows = await this.prisma.$queryRaw<
      Array<{
        id: string;
        name: string;
        case_name: string | null;
        localized_name: string | null;
        year_from: number | null;
        year_till: number | null;
        manufacturer_id: string;
        manufacturer_name: string;
        manufacturer_localized_name: string | null;
      }>
    >(Prisma.sql`
      SELECT DISTINCT
        v.id, v.name, v.case_name, v.localized_name, v.year_from, v.year_till,
        v.manufacturer_id,
        m.name AS manufacturer_name,
        m.localized_name AS manufacturer_localized_name
      FROM vehicle_model v
      JOIN manufacturer m ON m.id = v.manufacturer_id
      JOIN mc_equipment mc ON mc.vehicle_id = v.id AND mc.tenant_id = ${tenantId}::uuid
      JOIN publish_view p ON p.id = mc.id AND p.published = TRUE AND p.tenant_id = ${tenantId}::uuid
      WHERE v.manufacturer_id = ${manufacturerId}::uuid
      ORDER BY v.name
    `);
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      caseName: r.case_name,
      localizedName: r.localized_name,
      manufacturer: {
        id: r.manufacturer_id,
        name: r.manufacturer_name,
        localizedName: r.manufacturer_localized_name,
      },
      production: { from: r.year_from, till: r.year_till },
    }));
  }

  /**
   * Список карт ТО (mcEquipment) для авто, опубликованных в publish_view.
   */
  async getMaintenancesByVehicle(
    ctx: WwwTenantContext,
    vehicleId: string,
  ): Promise<WwwMaintenance[]> {
    const { tenantId } = ctx;
    const equipments = await this.prisma.mcEquipment.findMany({
      where: { vehicleId, tenantId },
      include: {
        lines: {
          orderBy: { position: 'asc' as const },
          include: {
            work: true,
            parts: {
              include: {
                part: {
                  include: {
                    manufacturer: true,
                    PartPrice: {
                      take: 1,
                      orderBy: { since: 'desc' as const },
                      select: { priceAmount: true, priceCurrencyCode: true },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (equipments.length === 0) return [];

    const equipmentIds = equipments.map((e) => e.id);
    const publishedRows = await this.prisma.$queryRaw<Array<{ id: string }>>(
      Prisma.sql`
        SELECT id FROM publish_view
        WHERE published = TRUE
          AND tenant_id = ${tenantId}::uuid
          AND id = ANY(${equipmentIds}::uuid[])
      `,
    );
    const publishedIds = new Set(publishedRows.map((p) => p.id));

    return equipments
      .filter((eq) => publishedIds.has(eq.id))
      .map((eq) => ({
        id: eq.id,
        engine: {
          name: eq.equipmentEngineName,
          type: FUEL_TYPE_NAME[eq.equipmentEngineType ?? 0] ?? null,
          airIntake: AIR_INTAKE_NAME[eq.equipmentEngineAirIntake ?? 0] ?? null,
          injection: INJECTION_NAME[eq.equipmentEngineInjection ?? 0] ?? null,
          capacity: eq.equipmentEngineCapacity || null,
        },
        transmission:
          TRANSMISSION_NAME[eq.equipmentTransmission ?? 0] ?? null,
        wheelDrive: WHEEL_DRIVE_NAME[eq.equipmentWheelDrive ?? 0] ?? null,
        works: eq.lines.map((line) => ({
          id: line.id,
          name: line.work?.name ?? '',
          description: null,
          period: line.period,
          position: line.position,
          recommended: line.recommended,
          price: {
            amount: Number(line.work?.priceAmount ?? 0n),
            currency: line.work?.priceCurrencyCode ?? 'RUB',
          },
          parts: line.parts.map((mp) => ({
            quantity: mp.quantity,
            part: {
              id: mp.partId,
              name: mp.part?.name ?? '',
              number: mp.part?.number ?? null,
              unit: null,
              price: {
                amount: Number(mp.part?.PartPrice?.[0]?.priceAmount ?? 0n),
                currency: mp.part?.PartPrice?.[0]?.priceCurrencyCode ?? 'RUB',
              },
              manufacturer: {
                id: mp.part?.manufacturer?.id ?? '',
                name: mp.part?.manufacturer?.name ?? '',
                localizedName: mp.part?.manufacturer?.localizedName ?? null,
              },
            },
          })),
        })),
      }));
  }

  // ──────────────────────────────────────────────────────────────────────
  // Mutations: создание обращений (заявки с www)
  // ──────────────────────────────────────────────────────────────────────

  async createAppealCalculator(
    ctx: WwwTenantContext,
    input: WwwCreateAppealCalculatorInput,
  ): Promise<{ appealId: string }> {
    const id = uuidv6();
    await this.prisma.appealCalculator.create({
      data: {
        id,
        tenantId: ctx.tenantId,
        name: input.name,
        note: input.note ?? null,
        phone: input.phone,
        date: input.date ?? null,
        equipmentId: input.equipmentId,
        mileage: input.mileage,
        total: input.total.amountMinor,
        works: input.works as unknown as Prisma.InputJsonValue,
        createdBy: SYSTEM_USER_ID,
      },
    });
    return { appealId: id };
  }

  async createAppealSchedule(
    ctx: WwwTenantContext,
    input: WwwCreateAppealScheduleInput,
  ): Promise<{ appealId: string }> {
    const id = uuidv6();
    await this.prisma.appealSchedule.create({
      data: {
        id,
        tenantId: ctx.tenantId,
        name: input.name,
        phone: input.phone,
        date: input.date,
        createdBy: SYSTEM_USER_ID,
      },
    });
    return { appealId: id };
  }

  async createAppealCooperation(
    ctx: WwwTenantContext,
    input: WwwCreateAppealCooperationInput,
  ): Promise<{ appealId: string }> {
    const id = uuidv6();
    await this.prisma.appealCooperation.create({
      data: {
        id,
        tenantId: ctx.tenantId,
        name: input.name,
        phone: input.phone,
        createdBy: SYSTEM_USER_ID,
      },
    });
    return { appealId: id };
  }

  async createAppealQuestion(
    ctx: WwwTenantContext,
    input: WwwCreateAppealQuestionInput,
  ): Promise<{ appealId: string }> {
    const id = uuidv6();
    await this.prisma.appealQuestion.create({
      data: {
        id,
        tenantId: ctx.tenantId,
        name: input.name,
        email: input.email,
        question: input.question,
        createdBy: SYSTEM_USER_ID,
      },
    });
    return { appealId: id };
  }

  async createAppealTireFitting(
    ctx: WwwTenantContext,
    input: WwwCreateAppealTireFittingInput,
  ): Promise<{ appealId: string }> {
    const id = uuidv6();
    await this.prisma.appealTireFitting.create({
      data: {
        id,
        tenantId: ctx.tenantId,
        name: input.name,
        phone: input.phone,
        modelId: input.vehicleId ?? null,
        category: TIRE_FITTING_CATEGORY_TO_INT[input.category],
        diameter: input.diameter ?? null,
        total: input.total.amountMinor,
        works: input.works as unknown as Prisma.InputJsonValue,
        createdBy: SYSTEM_USER_ID,
      },
    });
    return { appealId: id };
  }

  async createAppealCall(
    ctx: WwwTenantContext,
    input: WwwCreateAppealCallInput,
  ): Promise<{ appealId: string }> {
    const id = uuidv6();
    await this.prisma.appealCall.create({
      data: {
        id,
        tenantId: ctx.tenantId,
        phone: input.phone,
        createdBy: SYSTEM_USER_ID,
      },
    });
    return { appealId: id };
  }
}

function mapVehicle(v: {
  id: string;
  name: string;
  caseName: string | null;
  localizedName: string | null;
  yearFrom: number | null;
  yearTill: number | null;
  manufacturer: { id: string; name: string; localizedName: string | null };
}): WwwVehicle {
  return {
    id: v.id,
    name: v.name,
    caseName: v.caseName,
    localizedName: v.localizedName,
    manufacturer: {
      id: v.manufacturer.id,
      name: v.manufacturer.name,
      localizedName: v.manufacturer.localizedName,
    },
    production: { from: v.yearFrom, till: v.yearTill },
  };
}
