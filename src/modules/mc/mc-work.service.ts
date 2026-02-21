import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateMcWorkInput } from './inputs/create-mc-work.input';
import { UpdateMcWorkInput } from './inputs/update-mc-work.input';
import type { AuthContext } from 'src/common/user-id.store';

const DEFAULT_TAKE = 25;
const DEFAULT_SKIP = 0;

@Injectable()
export class McWorkService {
  constructor(private readonly prisma: PrismaService) {}

  async findMany(
    ctx: AuthContext,
    {
      take = DEFAULT_TAKE,
      skip = DEFAULT_SKIP,
      search,
    }: {
      take?: number;
      skip?: number;
      search?: string;
    },
  ) {
    const { tenantId } = ctx;
    const where = {
      tenantId,
      ...(search
        ? { name: { contains: search, mode: 'insensitive' as const } }
        : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.mcWork.findMany({
        where,
        take: +take,
        skip: +skip,
        orderBy: { name: 'asc' },
      }),
      this.prisma.mcWork.count({ where }),
    ]);
    return { items, total };
  }

  async findOne(ctx: AuthContext, id: string) {
    const { tenantId } = ctx;
    return this.prisma.mcWork.findFirst({
      where: { id, tenantId },
    });
  }

  async create(ctx: AuthContext, data: CreateMcWorkInput) {
    const { tenantId, userId } = ctx;
    return this.prisma.mcWork.create({
      data: {
        name: data.name.trim(),
        description: data.description?.trim() ?? null,
        comment: data.comment?.trim() ?? null,
        priceAmount: data.price?.amountMinor != null ? BigInt(data.price.amountMinor) : null,
        priceCurrencyCode: data.price?.currencyCode ?? null,
        tenantId,
        createdBy: userId,
      },
    });
  }

  async update(ctx: AuthContext, input: UpdateMcWorkInput) {
    const existing = await this.findOne(ctx, input.id);
    if (!existing) throw new NotFoundException('Работа не найдена');
    const data: {
      name?: string;
      description?: string | null;
      comment?: string | null;
      priceAmount?: bigint | null;
      priceCurrencyCode?: string | null;
    } = {};
    if (input.name !== undefined) data.name = input.name.trim();
    if (input.description !== undefined)
      data.description = input.description?.trim() ?? null;
    if (input.comment !== undefined)
      data.comment = input.comment?.trim() ?? null;
    if (input.price !== undefined) {
      data.priceAmount =
        input.price?.amountMinor != null ? BigInt(input.price.amountMinor) : null;
      data.priceCurrencyCode = input.price?.currencyCode ?? null;
    }
    return this.prisma.mcWork.update({
      where: { id: input.id },
      data,
    });
  }

  async remove(ctx: AuthContext, id: string) {
    const work = await this.findOne(ctx, id);
    if (!work) throw new NotFoundException('Работа не найдена');
    return this.prisma.mcWork.delete({
      where: { id },
    });
  }
}
