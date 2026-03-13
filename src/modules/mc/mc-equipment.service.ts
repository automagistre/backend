import { Injectable, NotFoundException } from '@nestjs/common';
import { type Car, Prisma } from 'src/generated/prisma/client';
import { normalizeEngineCapacity } from 'src/common/utils/engine-capacity.util';
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
        equipmentEngineCapacity: normalizeEngineCapacity(data.equipmentEngineCapacity) ?? data.equipmentEngineCapacity ?? '',
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
        baseData.equipmentEngineCapacity = normalizeEngineCapacity(input.equipmentEngineCapacity) ?? input.equipmentEngineCapacity;

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

  /**
   * Условие where для поиска комплектаций по данным авто: для ненулевых полей авто — (значение авто OR у комплектации 0).
   * У комплектации 0 = «не указано» / любой. Объём двигателя — точное совпадение (норма в БД).
   */
  private buildEquipmentWhereByCar(
    tenantId: string,
    vehicleId: string,
    car: Pick<
      Car,
      | 'equipmentTransmission'
      | 'equipmentWheelDrive'
      | 'equipmentEngineType'
      | 'equipmentEngineAirIntake'
      | 'equipmentEngineInjection'
      | 'equipmentEngineName'
      | 'equipmentEngineCapacity'
    >,
  ): Prisma.McEquipmentWhereInput {
    const tr = car.equipmentTransmission ?? 0;
    const wd = car.equipmentWheelDrive ?? 0;
    const et = car.equipmentEngineType ?? 0;
    const ai = car.equipmentEngineAirIntake ?? 0;
    const inj = car.equipmentEngineInjection ?? 0;
    const engineName = car.equipmentEngineName?.trim() ?? '';
    const capacity = normalizeEngineCapacity(car.equipmentEngineCapacity) ?? '';

    const and: Prisma.McEquipmentWhereInput[] = [];
    if (tr !== 0) and.push({ OR: [{ equipmentTransmission: 0 }, { equipmentTransmission: tr }] });
    if (wd !== 0) and.push({ OR: [{ equipmentWheelDrive: 0 }, { equipmentWheelDrive: wd }] });
    if (et !== 0) and.push({ OR: [{ equipmentEngineType: 0 }, { equipmentEngineType: et }] });
    if (ai !== 0) and.push({ OR: [{ equipmentEngineAirIntake: 0 }, { equipmentEngineAirIntake: ai }] });
    if (inj !== 0) and.push({ OR: [{ equipmentEngineInjection: 0 }, { equipmentEngineInjection: inj }] });
    // if (engineName !== '') and.push({ OR: [{ equipmentEngineName: null }, { equipmentEngineName: engineName }] });
    if (capacity !== '') and.push({ equipmentEngineCapacity: capacity });

    return {
      tenantId,
      vehicleId,
      ...(and.length > 0 ? { AND: and } : {}),
    };
  }

  /**
   * Все комплектации, подходящие автомобилю (vehicleId + фильтр по ненулевым полям: КПП, привод, двигатель и т.д.).
   * Для выбора шаблона ТО в модалке.
   */
  async findAllByCar(ctx: AuthContext, carId: string): Promise<
    Array<{
      id: string;
      period: number;
      equipmentEngineName: string | null;
      equipmentEngineCapacity: string;
      equipmentEngineType: number;
      equipmentTransmission: number;
      equipmentWheelDrive: number;
    }>
  > {
    const { tenantId, tenantGroupId } = ctx;
    const car = await this.prisma.car.findFirst({
      where: { id: carId, tenantGroupId },
      select: {
        vehicleId: true,
        equipmentTransmission: true,
        equipmentWheelDrive: true,
        equipmentEngineName: true,
        equipmentEngineType: true,
        equipmentEngineAirIntake: true,
        equipmentEngineInjection: true,
        equipmentEngineCapacity: true,
      },
    });
    if (!car?.vehicleId) return [];

    const where = this.buildEquipmentWhereByCar(tenantId, car.vehicleId, car);
    return this.prisma.mcEquipment.findMany({
      where,
      select: {
        id: true,
        period: true,
        equipmentEngineName: true,
        equipmentEngineCapacity: true,
        equipmentEngineType: true,
        equipmentTransmission: true,
        equipmentWheelDrive: true,
      },
    });
  }

  /**
   * Поиск одной комплектации по данным автомобиля (vehicleId + фильтр по ненулевым полям: КПП, привод, двигатель и т.д.).
   */
  async findOneByCar(ctx: AuthContext, carId: string) {
    const { tenantId, tenantGroupId } = ctx;
    const car = await this.prisma.car.findFirst({
      where: { id: carId, tenantGroupId },
      select: {
        vehicleId: true,
        equipmentTransmission: true,
        equipmentWheelDrive: true,
        equipmentEngineName: true,
        equipmentEngineType: true,
        equipmentEngineAirIntake: true,
        equipmentEngineInjection: true,
        equipmentEngineCapacity: true,
      },
    });
    if (!car?.vehicleId) return null;

    const where = this.buildEquipmentWhereByCar(tenantId, car.vehicleId, car);
    const match = await this.prisma.mcEquipment.findFirst({
      where,
      include: EQUIPMENT_INCLUDE,
    });
    return match;
  }

  /**
   * Все линии карты ТО по комплектации (без фильтра по пробегу).
   * Для фильтра по пробегу на клиенте: line.period > 0 && mileage % line.period === 0.
   */
  async getLinesForEquipment(
    ctx: AuthContext,
    equipmentId: string,
  ): Promise<
    Array<{
      period: number;
      recommended: boolean;
      work: { name: string; priceAmount: bigint | null; priceCurrencyCode: string | null };
      parts: Array<{
        partId: string;
        partName: string | null;
        partNumber: string | null;
        partManufacturerName: string | null;
        quantity: number;
        priceAmount: bigint | null;
        priceCurrencyCode: string | null;
      }>;
    }>
  > {
    const { tenantId } = ctx;
    const equipment = await this.prisma.mcEquipment.findFirst({
      where: { id: equipmentId, tenantId },
      include: {
        lines: {
          orderBy: { position: 'asc' as const },
          where: { period: { gt: 0 } },
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
    if (!equipment) return [];
    return equipment.lines.map((line) => ({
      period: line.period,
      recommended: line.recommended,
      work: {
        name: line.work?.name ?? '',
        priceAmount: line.work?.priceAmount ?? null,
        priceCurrencyCode: line.work?.priceCurrencyCode ?? null,
      },
      parts: line.parts.map((mp) => ({
        partId: mp.partId,
        partName: mp.part?.name ?? null,
        partNumber: mp.part?.number ?? null,
        partManufacturerName: mp.part?.manufacturer?.name ?? null,
        quantity: mp.quantity,
        priceAmount: mp.part?.PartPrice?.[0]?.priceAmount ?? null,
        priceCurrencyCode: mp.part?.PartPrice?.[0]?.priceCurrencyCode ?? null,
      })),
    }));
  }

  /**
   * Линии карты ТО по комплектации и пробегу (фильтр по кратности: mileage % line.period === 0).
   * Возвращает массив { work, parts } для добавления в заказ.
   */
  async getLinesForMileage(
    ctx: AuthContext,
    equipmentId: string,
    mileage: number,
  ): Promise<
    Array<{
      work: { name: string; priceAmount: bigint | null; priceCurrencyCode: string | null };
      parts: Array<{
        partId: string;
        quantity: number;
        priceAmount: bigint | null;
        priceCurrencyCode: string | null;
      }>;
    }>
  > {
    const { tenantId } = ctx;
    const equipment = await this.prisma.mcEquipment.findFirst({
      where: { id: equipmentId, tenantId },
      include: {
        lines: {
          orderBy: { position: 'asc' as const },
          where: { period: { gt: 0 } },
          include: {
            work: true,
            parts: {
              include: {
                part: {
                  include: {
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
    if (!equipment) return [];
    const filtered = equipment.lines.filter(
      (line) => line.period > 0 && mileage % line.period === 0,
    );
    return filtered.map((line) => ({
      work: {
        name: line.work?.name ?? '',
        priceAmount: line.work?.priceAmount ?? null,
        priceCurrencyCode: line.work?.priceCurrencyCode ?? null,
      },
      parts: line.parts.map((mp) => ({
        partId: mp.partId,
        quantity: mp.quantity,
        priceAmount: mp.part?.PartPrice?.[0]?.priceAmount ?? null,
        priceCurrencyCode: mp.part?.PartPrice?.[0]?.priceCurrencyCode ?? null,
      })),
    }));
  }
}
