import { ConflictException, Injectable } from '@nestjs/common';
import { SortDirection } from 'src/common/sorting.args';
import { PrismaService } from '../../prisma/prisma.service';
import { CreatePartInput } from './inputs/create.input';
import { PartModel } from './models/part.model';
import { UpdatePartInput } from './inputs/update.input';
import { cleanUpcaseString } from 'src/common/utils/clean-upcase.util';
import type { AuthContext } from 'src/common/user-id.store';
import { Prisma } from 'src/generated/prisma/client';

const DEFAULT_TAKE = 25;
const DEFAULT_SKIP = 0;

@Injectable()
export class PartService {
  constructor(private readonly prisma: PrismaService) {}

  private buildOrderBy(
    sortBy?: string,
    sortDir: SortDirection = SortDirection.ASC,
  ): Prisma.PartOrderByWithRelationInput[] {
    if (sortBy === 'name') return [{ name: sortDir }];
    if (sortBy === 'number') return [{ number: sortDir }];
    if (sortBy === 'manufacturer.name') return [{ manufacturer: { name: sortDir } }];
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
      return this.findManyOrderedByStock({ take, skip, search, sortDir, tenantId });
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
          { manufacturer: { name: { contains: term, mode: 'insensitive' as const } } },
          { manufacturer: { localizedName: { contains: term, mode: 'insensitive' as const } } },
        ],
      })),
    };
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

    const total = await this.prisma.part.count({ where: this.buildWhere(search) });
    const orderedIds = idsResult.map((r) => r.id);
    if (orderedIds.length === 0) {
      return { items: [], total };
    }

    const parts = await this.prisma.part.findMany({
      where: { id: { in: orderedIds } },
      include: { manufacturer: true },
    });
    const byId = new Map(parts.map((p) => [p.id, p]));
    const items = orderedIds.map((id) => byId.get(id)).filter(Boolean) as Awaited<
      ReturnType<PrismaService['part']['findMany']>
    >;

    return { items, total };
  }

  private buildStockSearchWhere(search?: string): { sql: string; params: unknown[] } {
    if (!search) {
      return { sql: '', params: [] };
    }
    const terms = search.trim().split(/\s+/).filter((t) => t.length > 0);
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
