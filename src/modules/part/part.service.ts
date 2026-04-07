import { ConflictException, Injectable } from '@nestjs/common';
import { SortDirection } from 'src/common/sorting.args';
import { PrismaService } from '../../prisma/prisma.service';
import { CreatePartInput } from './inputs/create.input';
import { PartModel } from './models/part.model';
import { UpdatePartInput } from './inputs/update.input';
import { cleanUpcaseString } from 'src/common/utils/clean-upcase.util';
import type { AuthContext } from 'src/common/user-id.store';
import { Prisma } from 'src/generated/prisma/client';
import { PartSmartAutocompleteItemModel } from './models/part-smart-autocomplete-item.model';

const DEFAULT_TAKE = 25;
const DEFAULT_SKIP = 0;
const SMART_AUTOCOMPLETE_DEFAULT_TAKE = 50;
const SMART_AUTOCOMPLETE_MAX_TAKE = 80;

type PartWithManufacturer = Prisma.PartGetPayload<{
  include: { manufacturer: true };
}>;

@Injectable()
export class PartService {
  constructor(private readonly prisma: PrismaService) {}

  private buildOrderBy(
    sortBy?: string,
    sortDir: SortDirection = SortDirection.ASC,
  ): Prisma.PartOrderByWithRelationInput[] {
    if (sortBy === 'name') return [{ name: sortDir }];
    if (sortBy === 'number') return [{ number: sortDir }];
    if (sortBy === 'manufacturer.name')
      return [{ manufacturer: { name: sortDir } }];
    return [{ id: SortDirection.DESC }];
  }

  async findAll(): Promise<PartModel[]> {
    const parts = await this.prisma.part.findMany({
      take: 2,
      include: {
        manufacturer: true,
      },
    });
    return parts;
  }

  async findMany({
    take = DEFAULT_TAKE,
    skip = DEFAULT_SKIP,
    search,
    sortBy,
    sortDir = SortDirection.ASC,
    tenantId,
  }: {
    take: number;
    skip: number;
    search?: string;
    sortBy?: string;
    sortDir?: SortDirection;
    tenantId?: string;
  }) {
    if (sortBy === 'stockQuantity' && tenantId) {
      return this.findManyOrderedByStock({
        take,
        skip,
        search,
        sortDir,
        tenantId,
      });
    }

    const where = this.buildWhere(search);
    const orderBy = this.buildOrderBy(sortBy, sortDir);

    const [items, total] = await Promise.all([
      this.prisma.part.findMany({
        where,
        take: +take,
        skip: +skip,
        include: { manufacturer: true },
        orderBy,
      }),
      this.prisma.part.count({ where }),
    ]);

    return { items, total };
  }

  async smartAutocomplete({
    search,
    tenantId,
    vehicleId,
    take = SMART_AUTOCOMPLETE_DEFAULT_TAKE,
  }: {
    search: string;
    tenantId: string;
    vehicleId?: string | null;
    take?: number;
  }): Promise<PartSmartAutocompleteItemModel[]> {
    const normalizedSearch = search.trim();
    if (!normalizedSearch) return [];

    const limitedTake = Math.max(
      1,
      Math.min(take, SMART_AUTOCOMPLETE_MAX_TAKE),
    );
    let mainParts: PartWithManufacturer[] = [];

    if (vehicleId) {
      mainParts = await this.searchWithVehicleCases({
        search: normalizedSearch,
        tenantId,
        vehicleId,
        take: limitedTake,
      });

      // По требованиям fallback без кузова запускается только если по кузову 0 результатов.
      if (mainParts.length === 0) {
        mainParts = await this.searchWithoutVehicleCases({
          search: normalizedSearch,
          tenantId,
          take: limitedTake,
        });
      }
    } else {
      // Если кузов не передан, сразу выполняем общий поиск.
      mainParts = await this.searchWithoutVehicleCases({
        search: normalizedSearch,
        tenantId,
        take: limitedTake,
      });
    }

    const items: PartSmartAutocompleteItemModel[] = mainParts.map((part) => ({
      part,
      isAnalog: false,
      analogGroupKey: null,
      analogGroupLabel: null,
    }));

    if (mainParts.length <= 3) {
      const analogs = await this.fetchAnalogsInStock({
        sourceParts: mainParts,
        tenantId,
        limit: limitedTake - items.length,
      });
      items.push(...analogs);
    }

    return items.slice(0, limitedTake);
  }

  private buildWhere(search?: string): Prisma.PartWhereInput {
    if (!search) return {};
    const terms = search
      .trim()
      .split(/\s+/)
      .filter((t) => t.length > 0);
    return {
      AND: terms.map((term) => ({
        OR: [
          { name: { contains: term, mode: 'insensitive' as const } },
          { number: { contains: term, mode: 'insensitive' as const } },
          {
            manufacturer: {
              name: { contains: term, mode: 'insensitive' as const },
            },
          },
          {
            manufacturer: {
              localizedName: { contains: term, mode: 'insensitive' as const },
            },
          },
        ],
      })),
    };
  }

  private buildTokenWhere(search: string): Prisma.PartWhereInput {
    const terms = search
      .trim()
      .split(/\s+/)
      .filter((t) => t.length > 0);

    return {
      AND: terms.map((term) => ({
        OR: [
          { name: { contains: term, mode: 'insensitive' as const } },
          { number: { contains: term, mode: 'insensitive' as const } },
          {
            manufacturer: {
              name: { contains: term, mode: 'insensitive' as const },
            },
          },
          {
            manufacturer: {
              localizedName: { contains: term, mode: 'insensitive' as const },
            },
          },
        ],
      })),
    };
  }

  private async searchWithVehicleCases({
    search,
    tenantId,
    vehicleId,
    take,
  }: {
    search: string;
    tenantId: string;
    vehicleId: string;
    take: number;
  }): Promise<PartWithManufacturer[]> {
    const caseRows = await this.prisma.partCase.findMany({
      where: { vehicleId },
      select: { partId: true },
    });
    const partIds = Array.from(new Set(caseRows.map((r) => r.partId)));
    if (partIds.length === 0) return [];

    const candidates = await this.prisma.part.findMany({
      where: {
        id: { in: partIds },
        ...this.buildTokenWhere(search),
      },
      include: { manufacturer: true },
      take: Math.max(take * 3, take),
    });

    return this.sortPartsByStock(candidates, tenantId, take);
  }

  private async searchWithoutVehicleCases({
    search,
    tenantId,
    take,
  }: {
    search: string;
    tenantId: string;
    take: number;
  }): Promise<PartWithManufacturer[]> {
    const candidates = await this.prisma.part.findMany({
      where: this.buildTokenWhere(search),
      include: { manufacturer: true },
      take: Math.max(take * 3, take),
    });

    return this.sortPartsByStock(candidates, tenantId, take);
  }

  private async sortPartsByStock(
    parts: PartWithManufacturer[],
    tenantId: string,
    take: number,
  ): Promise<PartWithManufacturer[]> {
    if (parts.length === 0) return [];
    const stockByPartId = await this.getStockByPartIds(
      parts.map((p) => p.id),
      tenantId,
    );

    return parts
      .slice()
      .sort((a, b) => {
        const stockA = stockByPartId.get(a.id) ?? 0;
        const stockB = stockByPartId.get(b.id) ?? 0;
        if (stockA !== stockB) return stockB - stockA;
        const nameCmp = a.name.localeCompare(b.name, 'ru');
        if (nameCmp !== 0) return nameCmp;
        return a.number.localeCompare(b.number, 'ru');
      })
      .slice(0, take);
  }

  private async getStockByPartIds(
    partIds: string[],
    tenantId: string,
  ): Promise<Map<string, number>> {
    if (partIds.length === 0) return new Map();

    const grouped = await this.prisma.motion.groupBy({
      by: ['partId'],
      where: {
        tenantId,
        partId: { in: partIds },
      },
      _sum: { quantity: true },
    });

    const result = new Map<string, number>();
    for (const row of grouped) {
      if (!row.partId) continue;
      result.set(row.partId, row._sum.quantity ?? 0);
    }
    return result;
  }

  private async fetchAnalogsInStock({
    sourceParts,
    tenantId,
    limit,
  }: {
    sourceParts: PartWithManufacturer[];
    tenantId: string;
    limit: number;
  }): Promise<PartSmartAutocompleteItemModel[]> {
    if (sourceParts.length === 0 || limit <= 0) return [];

    const sourcePartIds = sourceParts.map((p) => p.id);
    const sourceById = new Map(sourceParts.map((p) => [p.id, p]));

    const sourceCrossLinks = await this.prisma.partCrossPart.findMany({
      where: { partId: { in: sourcePartIds } },
      select: { partId: true, partCrossId: true },
    });
    if (sourceCrossLinks.length === 0) return [];

    const sourcePartByCross = new Map<string, PartWithManufacturer>();
    for (const link of sourceCrossLinks) {
      if (!sourcePartByCross.has(link.partCrossId)) {
        const sourcePart = sourceById.get(link.partId);
        if (sourcePart) {
          sourcePartByCross.set(link.partCrossId, sourcePart);
        }
      }
    }

    const crossIds = Array.from(
      new Set(sourceCrossLinks.map((l) => l.partCrossId)),
    );
    const groupMembers = await this.prisma.partCrossPart.findMany({
      where: { partCrossId: { in: crossIds } },
      include: { part: { include: { manufacturer: true } } },
    });

    const excludedIds = new Set(sourcePartIds);
    const seenAnalogIds = new Set<string>();
    const candidateAnalogs: Array<{
      part: PartWithManufacturer;
      partCrossId: string;
      groupLabel: string;
    }> = [];

    for (const member of groupMembers) {
      if (!member.part) continue;
      if (excludedIds.has(member.partId)) continue;
      if (seenAnalogIds.has(member.partId)) continue;
      seenAnalogIds.add(member.partId);

      const sourcePart = sourcePartByCross.get(member.partCrossId);
      const groupLabel = sourcePart
        ? `Аналоги для ${sourcePart.number}`
        : 'Аналоги';

      candidateAnalogs.push({
        part: member.part,
        partCrossId: member.partCrossId,
        groupLabel,
      });
    }

    if (candidateAnalogs.length === 0) return [];

    const stockByPartId = await this.getStockByPartIds(
      candidateAnalogs.map((a) => a.part.id),
      tenantId,
    );

    const groupedByCross = new Map<
      string,
      Array<{ part: PartWithManufacturer; stock: number; groupLabel: string }>
    >();
    for (const analog of candidateAnalogs) {
      const stock = stockByPartId.get(analog.part.id) ?? 0;
      if (stock <= 0) continue;
      const bucket = groupedByCross.get(analog.partCrossId) ?? [];
      bucket.push({ part: analog.part, stock, groupLabel: analog.groupLabel });
      groupedByCross.set(analog.partCrossId, bucket);
    }

    const result: PartSmartAutocompleteItemModel[] = [];
    for (const [crossId, parts] of groupedByCross.entries()) {
      const ordered = parts.slice().sort((a, b) => {
        if (a.stock !== b.stock) return b.stock - a.stock;
        const nameCmp = a.part.name.localeCompare(b.part.name, 'ru');
        if (nameCmp !== 0) return nameCmp;
        return a.part.number.localeCompare(b.part.number, 'ru');
      });

      for (const item of ordered) {
        if (result.length >= limit) return result;
        result.push({
          part: item.part,
          isAnalog: true,
          analogGroupKey: crossId,
          analogGroupLabel: item.groupLabel,
        });
      }
    }

    return result;
  }

  private async findManyOrderedByStock({
    take,
    skip,
    search,
    sortDir,
    tenantId,
  }: {
    take: number;
    skip: number;
    search?: string;
    sortDir: SortDirection;
    tenantId: string;
  }) {
    const dir = sortDir === SortDirection.ASC ? 'ASC' : 'DESC';
    const whereClause = this.buildStockSearchWhere(search);

    const tenantIdx = whereClause.params.length + 1;
    const limitIdx = tenantIdx + 1;
    const offsetIdx = tenantIdx + 2;

    const idsResult = (await this.prisma.$queryRawUnsafe<{ id: string }[]>(
      `
      WITH part_stock AS (
        SELECT part_id, COALESCE(SUM(quantity), 0)::int AS stock
        FROM motion
        WHERE tenant_id = $${tenantIdx}
        GROUP BY part_id
      )
      SELECT p.id
      FROM part p
      LEFT JOIN manufacturer m ON m.id = p.manufacturer_id
      LEFT JOIN part_stock ps ON ps.part_id = p.id
      ${whereClause.sql}
      ORDER BY COALESCE(ps.stock, 0) ${dir}
      LIMIT $${limitIdx} OFFSET $${offsetIdx}
      `,
      ...whereClause.params,
      tenantId,
      +take,
      +skip,
    )) as { id: string }[];

    const total = await this.prisma.part.count({
      where: this.buildWhere(search),
    });
    const orderedIds = idsResult.map((r) => r.id);
    if (orderedIds.length === 0) {
      return { items: [], total };
    }

    const parts = await this.prisma.part.findMany({
      where: { id: { in: orderedIds } },
      include: { manufacturer: true },
    });
    const byId = new Map(parts.map((p) => [p.id, p]));
    const items = orderedIds
      .map((id) => byId.get(id))
      .filter(Boolean) as Awaited<
      ReturnType<PrismaService['part']['findMany']>
    >;

    return { items, total };
  }

  private buildStockSearchWhere(search?: string): {
    sql: string;
    params: unknown[];
  } {
    if (!search) {
      return { sql: '', params: [] };
    }
    const terms = search
      .trim()
      .split(/\s+/)
      .filter((t) => t.length > 0);
    const conditions: string[] = [];
    const params: unknown[] = [];
    let idx = 1;
    for (const term of terms) {
      const pattern = `%${term}%`;
      params.push(pattern);
      conditions.push(
        `(p.name ILIKE $${idx} OR p.number ILIKE $${idx} OR m.name ILIKE $${idx} OR m.localized_name ILIKE $${idx})`,
      );
      idx += 1;
    }
    return { sql: `WHERE ${conditions.join(' AND ')}`, params };
  }

  async getAverageSoldQuantity(
    partId: string,
    tenantId: string,
  ): Promise<number | null> {
    const recentSales = await this.prisma.orderItemPart.findMany({
      where: {
        partId,
        orderItem: {
          tenantId,
          order: { status: 10 },
        },
      },
      select: { quantity: true },
      orderBy: { id: 'desc' },
      take: 100,
    });

    if (recentSales.length === 0) return null;

    const totalQuantity = recentSales.reduce(
      (sum, row) => sum + (row.quantity ?? 0),
      0,
    );
    const avgRaw = totalQuantity / recentSales.length;

    return Math.max(1, Math.round(avgRaw / 100));
  }

  async findOne(id: string): Promise<PartModel | null> {
    const part = await this.prisma.part.findUnique({
      where: { id },
      include: {
        manufacturer: true,
      },
    });
    return part;
  }

  async create(ctx: AuthContext, input: CreatePartInput): Promise<PartModel> {
    const cleanedNumber = cleanUpcaseString(input.number);

    const existing = await this.prisma.part.findFirst({
      where: {
        number: cleanedNumber,
        manufacturerId: input.manufacturerId,
      },
    });

    if (existing) {
      throw new ConflictException(
        `Запчасть с артикулом "${cleanedNumber}" от этого производителя уже существует`,
      );
    }

    const part = await this.prisma.part.create({
      data: {
        ...input,
        number: cleanedNumber,
        createdBy: ctx.userId,
      },
      include: {
        manufacturer: true,
      },
    });

    return part;
  }

  async update(ctx: AuthContext, input: UpdatePartInput): Promise<PartModel> {
    const { tenantId, userId } = ctx;
    const { id, orderFromQuantity, orderUpToQuantity, ...data } = input;
    if (data?.number) {
      data.number = cleanUpcaseString(data.number);
    }

    const part = await this.prisma.$transaction(async (tx) => {
      const updatedPart = await tx.part.update({
        where: { id },
        data,
        include: {
          manufacturer: true,
        },
      });

      // Обработка PartRequiredAvailability
      // Обрабатываем только если заданы оба поля
      if (
        orderFromQuantity !== undefined &&
        orderFromQuantity !== null &&
        orderUpToQuantity !== undefined &&
        orderUpToQuantity !== null
      ) {
        // Валидация
        if (orderFromQuantity < 0 || orderUpToQuantity < 0) {
          throw new Error(
            'orderFromQuantity и orderUpToQuantity должны быть >= 0',
          );
        }
        if (orderUpToQuantity !== 0 && orderFromQuantity >= orderUpToQuantity) {
          throw new Error(
            'orderUpToQuantity должен быть > orderFromQuantity (или равен 0)',
          );
        }

        // Историческая система: всегда создаем новую запись (как с ценой)
        // Даже если оба поля = 0, создаем запись (это означает "запасы не контролируются")
        await tx.partRequiredAvailability.create({
          data: {
            partId: id,
            tenantId,
            orderFromQuantity,
            orderUpToQuantity,
            createdBy: userId,
          },
        });
      }

      return updatedPart;
    });

    return part;
  }

  // TODO: Проверить миграцию — в схеме onDelete: Restrict, но в БД может быть NO ACTION.
  // После применения миграции можно убрать ручные проверки и полагаться на constraint БД.
  async delete(id: string): Promise<PartModel> {
    const [
      orderItemPartCount,
      incomePartCount,
      motionCount,
      mcPartCount,
      partSupplyCount,
      carRecommendationPartCount,
    ] = await Promise.all([
      this.prisma.orderItemPart.count({ where: { partId: id } }),
      this.prisma.incomePart.count({ where: { partId: id } }),
      this.prisma.motion.count({ where: { partId: id } }),
      this.prisma.mcPart.count({ where: { partId: id } }),
      this.prisma.partSupply.count({ where: { partId: id } }),
      this.prisma.carRecommendationPart.count({ where: { partId: id } }),
    ]);

    const totalRefs =
      orderItemPartCount +
      incomePartCount +
      motionCount +
      mcPartCount +
      partSupplyCount +
      carRecommendationPartCount;

    if (totalRefs > 0) {
      throw new ConflictException(
        'Нельзя удалить запчасть: есть связанные записи (заказы, приходы, движения, ТО, рекомендации)',
      );
    }

    return await this.prisma.part.delete({
      where: { id },
      include: {
        manufacturer: true,
      },
    });
  }
}
