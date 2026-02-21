import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from 'src/generated/prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateMcEquipmentInput } from './inputs/create-mc-equipment.input';
import { UpdateMcEquipmentInput } from './inputs/update-mc-equipment.input';
import type { AuthContext } from 'src/common/user-id.store';

const DEFAULT_TAKE = 25;
const DEFAULT_SKIP = 0;

const EQUIPMENT_INCLUDE = {
  vehicle: { include: { manufacturer: true } },
  lines: {
    orderBy: { position: Prisma.SortOrder.asc },
    include: {
      work: true,
      parts: { include: { part: { include: { manufacturer: true } } } },
    },
  },
};

@Injectable()
export class McEquipmentService {
  constructor(private readonly prisma: PrismaService) {}

  async findMany(
    ctx: AuthContext,
    {
      take = DEFAULT_TAKE,
      skip = DEFAULT_SKIP,
      search,
      vehicleId,
      period,
    }: {
      take?: number;
      skip?: number;
      search?: string;
      vehicleId?: string;
      period?: number;
    },
  ) {
    const { tenantId } = ctx;
    const where = {
      tenantId,
      ...(vehicleId ? { vehicleId } : {}),
      ...(period != null ? { period } : {}),
      ...(search
        ? {
            vehicle: {
              OR: [
                { name: { contains: search, mode: 'insensitive' as const } },
                {
                  localizedName: {
                    contains: search,
                    mode: 'insensitive' as const,
                  },
                },
              ],
            },
          }
        : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.mcEquipment.findMany({
        where,
        take: +take,
        skip: +skip,
        orderBy: [{ vehicle: { name: 'asc' } }, { period: 'asc' }],
        include: EQUIPMENT_INCLUDE,
      }),
      this.prisma.mcEquipment.count({ where }),
    ]);
    return { items, total };
  }

  async findOne(ctx: AuthContext, id: string) {
    const { tenantId } = ctx;
    return this.prisma.mcEquipment.findFirst({
      where: { id, tenantId },
      include: EQUIPMENT_INCLUDE,
    });
  }

  async create(ctx: AuthContext, data: CreateMcEquipmentInput) {
    const { tenantId, userId } = ctx;
    return this.prisma.mcEquipment.create({
      data: {
        vehicleId: data.vehicleId,
        period: data.period,
        equipmentTransmission: data.equipmentTransmission ?? 0,
        equipmentWheelDrive: data.equipmentWheelDrive ?? 0,
        equipmentEngineName: data.equipmentEngineName ?? null,
        equipmentEngineType: data.equipmentEngineType ?? 0,
        equipmentEngineAirIntake: data.equipmentEngineAirIntake ?? 0,
        equipmentEngineInjection: data.equipmentEngineInjection ?? 0,
        equipmentEngineCapacity: data.equipmentEngineCapacity,
        tenantId,
        createdBy: userId,
      },
      include: EQUIPMENT_INCLUDE,
    });
  }

  async update(ctx: AuthContext, input: UpdateMcEquipmentInput) {
    const existing = await this.findOne(ctx, input.id);
    if (!existing) throw new NotFoundException('Комплектация не найдена');

    const { tenantId, userId } = ctx;

    await this.prisma.$transaction(async (tx) => {
      const baseData: Record<string, unknown> = {};
      if (input.vehicleId !== undefined) baseData.vehicleId = input.vehicleId;
      if (input.period !== undefined) baseData.period = input.period;
      if (input.equipmentTransmission !== undefined)
        baseData.equipmentTransmission = input.equipmentTransmission;
      if (input.equipmentWheelDrive !== undefined)
        baseData.equipmentWheelDrive = input.equipmentWheelDrive;
      if (input.equipmentEngineName !== undefined)
        baseData.equipmentEngineName = input.equipmentEngineName ?? null;
      if (input.equipmentEngineType !== undefined)
        baseData.equipmentEngineType = input.equipmentEngineType;
      if (input.equipmentEngineAirIntake !== undefined)
        baseData.equipmentEngineAirIntake = input.equipmentEngineAirIntake;
      if (input.equipmentEngineInjection !== undefined)
        baseData.equipmentEngineInjection = input.equipmentEngineInjection;
      if (input.equipmentEngineCapacity !== undefined)
        baseData.equipmentEngineCapacity = input.equipmentEngineCapacity;

      if (Object.keys(baseData).length > 0) {
        await tx.mcEquipment.update({
          where: { id: input.id },
          data: baseData,
        });
      }

      if (input.lines !== undefined) {
        const lines = await tx.mcLine.findMany({
          where: { equipmentId: input.id },
          select: { id: true },
        });
        await tx.mcPart.deleteMany({
          where: { lineId: { in: lines.map((l) => l.id) } },
        });
        await tx.mcLine.deleteMany({ where: { equipmentId: input.id } });
        for (let i = 0; i < input.lines.length; i++) {
          const line = input.lines[i];
          const lineRecord = await tx.mcLine.create({
            data: {
              equipmentId: input.id,
              workId: line.workId,
              period: line.period,
              recommended: line.recommended,
              position: line.position,
              tenantId,
              createdBy: userId,
            },
          });
          for (const p of line.parts) {
            await tx.mcPart.create({
              data: {
                lineId: lineRecord.id,
                partId: p.partId,
                quantity: p.quantity,
                recommended: p.recommended,
                tenantId,
                createdBy: userId,
              },
            });
          }
        }
      }
    });

    const updated = await this.findOne(ctx, input.id);
    if (!updated) throw new NotFoundException('Комплектация не найдена');
    return updated;
  }

  async remove(ctx: AuthContext, id: string) {
    const equipment = await this.findOne(ctx, id);
    if (!equipment) throw new NotFoundException('Комплектация не найдена');
    const lines = await this.prisma.mcLine.findMany({
      where: { equipmentId: id },
      select: { id: true },
    });
    const lineIds = lines.map((l) => l.id);
    await this.prisma.mcPart.deleteMany({ where: { lineId: { in: lineIds } } });
    await this.prisma.mcLine.deleteMany({ where: { equipmentId: id } });
    return this.prisma.mcEquipment.delete({
      where: { id },
    });
  }
}
