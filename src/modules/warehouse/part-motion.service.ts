import { Injectable } from '@nestjs/common';
import { Prisma } from 'src/generated/prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateMotionInput } from './inputs/create-motion.input';
import { Motion } from 'src/generated/prisma/client';
import { MotionSourceType } from './enums/motion-source-type.enum';
import { TenantService } from 'src/common/services/tenant.service';

@Injectable()
export class PartMotionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantService: TenantService,
  ) {}

  async create(dto: CreateMotionInput): Promise<Motion> {
    if (dto.quantity === 0) throw new Error('Количество не может быть равно нулю');
    const tenantId = await this.tenantService.getTenantId();
    return this.createWithinTransaction(
      this.prisma as unknown as Prisma.TransactionClient,
      dto,
      tenantId,
    );
  }

  async createWithinTransaction(
    tx: Prisma.TransactionClient,
    dto: CreateMotionInput,
    tenantId: string,
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
      },
    });
  }

  async getStockQuantity(partId: string): Promise<number> {
    const tenantId = await this.tenantService.getTenantId();
    const result = await this.prisma.motion.aggregate({
      where: { partId, tenantId },
      _sum: { quantity: true },
    });
    return result._sum.quantity ?? 0;
  }

  async getStockQuantityByPartIds(
    partIds: string[],
    tenantId?: string,
  ): Promise<Map<string, number>> {
    const resolvedTenantId = tenantId ?? (await this.tenantService.getTenantId());
    if (partIds.length === 0) return new Map();

    const rows = await this.prisma.motion.groupBy({
      by: ['partId'],
      where: {
        partId: { in: partIds },
        tenantId: resolvedTenantId,
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

  async findByPartId(partId: string): Promise<Motion[]> {
    const tenantId = await this.tenantService.getTenantId();
    return this.prisma.motion.findMany({
      where: { partId, tenantId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async increase(
    partId: string,
    quantity: number,
    sourceType: MotionSourceType,
    sourceId: string,
    description?: string,
  ): Promise<Motion> {
    if (quantity <= 0) throw new Error('Количество должно быть положительным');
    return this.create({ partId, quantity, sourceType, sourceId, description });
  }

  async decrease(
    partId: string,
    quantity: number,
    sourceType: MotionSourceType,
    sourceId: string,
    description?: string,
  ): Promise<Motion> {
    if (quantity <= 0) throw new Error('Количество должно быть положительным');
    return this.create({ partId, quantity: -quantity, sourceType, sourceId, description });
  }
}
