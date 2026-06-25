import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { normalizeEngineCapacity } from 'src/common/utils/engine-capacity.util';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateCarInput, UpdateCarInputPrisma } from './inputs/car.input';
import type { AuthContext } from 'src/common/user-id.store';
import { AuditLogService } from 'src/modules/audit-log/audit-log.service';
import { AuditEntityType } from 'src/modules/audit-log/enums/audit.enums';
import { DisplayContextService } from 'src/modules/display-context/display-context.service';

@Injectable()
export class CarService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
    private readonly displayContext: DisplayContextService,
  ) {}

  private static prepareCarData<
    T extends { equipmentEngineCapacity?: string | null },
  >(data: T): T {
    if (
      data.equipmentEngineCapacity !== undefined &&
      data.equipmentEngineCapacity !== null
    ) {
      const normalized = normalizeEngineCapacity(data.equipmentEngineCapacity);
      return {
        ...data,
        equipmentEngineCapacity: normalized ?? data.equipmentEngineCapacity,
      };
    }
    return data;
  }

  async create(ctx: AuthContext, data: CreateCarInput) {
    const prepared = CarService.prepareCarData(data);
    const created = await this.prisma.car.create({
      include: {
        vehicle: {
          include: {
            manufacturer: true,
          },
        },
      },
      data: {
        ...prepared,
        mileage: 0,
        tenantGroupId: ctx.tenantGroupId,
        createdBy: ctx.userId,
      },
    });

    await this.auditLog.record(this.prisma, ctx, {
      rootEntityType: AuditEntityType.CAR,
      rootEntityId: created.id,
      entityType: AuditEntityType.CAR,
      entityId: created.id,
      before: null,
      after: created,
      entityDisplayName: await this.displayContext.getCarDisplay(created.id),
    });

    return created;
  }

  async update(ctx: AuthContext, { id, ...data }: UpdateCarInputPrisma) {
    const existing = await this.prisma.car.findFirst({
      where: { id, tenantGroupId: ctx.tenantGroupId },
    });
    if (!existing) {
      throw new NotFoundException('Автомобиль не найден или недоступен');
    }

    const prepared = CarService.prepareCarData(data);
    const updated = await this.prisma.car.update({
      include: {
        vehicle: {
          include: {
            manufacturer: true,
          },
        },
      },
      where: { id },
      data: prepared,
    });

    await this.auditLog.record(this.prisma, ctx, {
      rootEntityType: AuditEntityType.CAR,
      rootEntityId: id,
      entityType: AuditEntityType.CAR,
      entityId: id,
      before: existing,
      after: updated,
      entityDisplayName: await this.displayContext.getCarDisplay(id),
    });

    return updated;
  }

  async findMany(
    ctx: AuthContext,
    {
      take,
      skip,
      search,
    }: {
      take?: number;
      skip?: number;
      search?: string;
    },
  ) {
    const baseWhere = { tenantGroupId: ctx.tenantGroupId };

    const where = search
      ? {
          ...baseWhere,
          OR: [
            { identifier: { contains: search, mode: 'insensitive' as const } },
            { gosnomer: { contains: search, mode: 'insensitive' as const } },
            { description: { contains: search, mode: 'insensitive' as const } },
            {
              vehicle: {
                OR: [
                  { name: { contains: search, mode: 'insensitive' as const } },
                  {
                    manufacturer: {
                      name: { contains: search, mode: 'insensitive' as const },
                    },
                  },
                ],
              },
            },
          ],
        }
      : baseWhere;

    const [items, total] = await Promise.all([
      this.prisma.car.findMany({
        take,
        skip,
        where,
        include: {
          vehicle: {
            include: {
              manufacturer: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.car.count({ where }),
    ]);

    return { items, total };
  }

  async findById(ctx: AuthContext, id: string) {
    return this.prisma.car.findFirst({
      where: { id, tenantGroupId: ctx.tenantGroupId },
      include: {
        vehicle: {
          include: {
            manufacturer: true,
          },
        },
      },
    });
  }

  async findByIdentifier(ctx: AuthContext, identifier: string) {
    return this.prisma.car.findFirst({
      where: { identifier, tenantGroupId: ctx.tenantGroupId },
      include: {
        vehicle: {
          include: {
            manufacturer: true,
          },
        },
      },
    });
  }

  // TODO: CalendarEntryOrderInfo.carId и Order.carId имеют onDelete: SetNull/Restrict.
  // Ручные проверки для бизнес-логики.
  async delete(ctx: AuthContext, id: string) {
    const existing = await this.prisma.car.findFirst({
      where: { id, tenantGroupId: ctx.tenantGroupId },
    });
    if (!existing) {
      throw new NotFoundException('Автомобиль не найден или недоступен');
    }

    const [orderCount, calendarCount, recommendationCount] = await Promise.all([
      this.prisma.order.count({ where: { carId: id } }),
      this.prisma.calendarEntryOrderInfo.count({ where: { carId: id } }),
      this.prisma.carRecommendation.count({ where: { carId: id } }),
    ]);

    if (orderCount > 0) {
      throw new ConflictException(
        `Нельзя удалить: есть ${orderCount} связанных заказов`,
      );
    }

    if (calendarCount > 0) {
      throw new ConflictException(
        `Нельзя удалить: есть ${calendarCount} записей в календаре`,
      );
    }

    if (recommendationCount > 0) {
      throw new ConflictException(
        `Нельзя удалить: есть ${recommendationCount} рекомендаций`,
      );
    }

    const displayName = await this.displayContext.getCarDisplay(id);
    const deleted = await this.prisma.car.delete({ where: { id } });

    await this.auditLog.record(this.prisma, ctx, {
      rootEntityType: AuditEntityType.CAR,
      rootEntityId: id,
      entityType: AuditEntityType.CAR,
      entityId: id,
      before: existing,
      after: null,
      entityDisplayName: displayName,
    });

    return deleted;
  }
}
