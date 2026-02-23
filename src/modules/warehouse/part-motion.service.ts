import { Injectable } from '@nestjs/common';
import { Prisma } from 'src/generated/prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateMotionInput } from './inputs/create-motion.input';
import { Motion } from 'src/generated/prisma/client';
import { MotionSourceType } from './enums/motion-source-type.enum';
import type { AuthContext } from 'src/common/user-id.store';

@Injectable()
export class PartMotionService {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  async create(ctx: AuthContext, dto: CreateMotionInput): Promise<Motion> {
    if (dto.quantity === 0) throw new Error('Количество не может быть равно нулю');
    return this.createWithinTransaction(
      this.prisma as unknown as Prisma.TransactionClient,
      dto,
      ctx.tenantId,
      ctx.userId,
    );
  }

  async createWithinTransaction(
    tx: Prisma.TransactionClient,
    dto: CreateMotionInput,
    tenantId: string,
    createdBy: string | null = null,
  ): Promise<Motion> {
    if (dto.quantity === 0) throw new Error('Количество не может быть равно нулю');
    return tx.motion.create({
      data: {
        partId: dto.partId,
        quantity: dto.quantity,
        description: dto.description ?? null,
        tenantId,
        sourceType: dto.sourceType,
        sourceId: dto.sourceId,
        createdBy,
      },
    });
  }

  async getStockQuantity(ctx: AuthContext, partId: string): Promise<number> {
    const result = await this.prisma.motion.aggregate({
      where: { partId, tenantId: ctx.tenantId },
      _sum: { quantity: true },
    });
    return result._sum.quantity ?? 0;
  }

  async getStockQuantityByPartIds(
    partIds: string[],
    tenantId: string,
  ): Promise<Map<string, number>> {
    if (partIds.length === 0) return new Map();

    const rows = await this.prisma.motion.groupBy({
      by: ['partId'],
      where: {
        partId: { in: partIds },
        tenantId,
      },
      _sum: { quantity: true },
    });

    const result = new Map<string, number>();
    for (const r of rows) {
      if (r.partId) {
        result.set(r.partId, r._sum.quantity ?? 0);
      }
    }
    return result;
  }

  async findByPartId(ctx: AuthContext, partId: string): Promise<Motion[]> {
    return this.prisma.motion.findMany({
      where: { partId, tenantId: ctx.tenantId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async increase(
    ctx: AuthContext,
    partId: string,
    quantity: number,
    sourceType: MotionSourceType,
    sourceId: string,
    description?: string,
  ): Promise<Motion> {
    if (quantity <= 0) throw new Error('Количество должно быть положительным');
    return this.create(ctx, { partId, quantity, sourceType, sourceId, description });
  }

  async decrease(
    ctx: AuthContext,
    partId: string,
    quantity: number,
    sourceType: MotionSourceType,
    sourceId: string,
    description?: string,
  ): Promise<Motion> {
    if (quantity <= 0) throw new Error('Количество должно быть положительным');
    return this.create(ctx, { partId, quantity: -quantity, sourceType, sourceId, description });
  }
}
