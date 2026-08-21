import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from 'src/generated/prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import type { AuthContext } from 'src/common/user-id.store';
import {
  CreateStaffPositionInput,
  StaffPositionSettingInput,
  UpdateStaffPositionInput,
} from './inputs/staff-position.input';
import {
  StaffPositionSettingKey,
  StaffPositionSettingType,
} from './enums/staff-position-setting.enum';
import { getStaffPositionSettingDefinition } from './staff-position-settings.catalog';
import {
  STAFF_POSITION_INCLUDE,
  toStaffPositionModel,
} from './staff-position.mapper';

const DEFAULT_TAKE = 25;
const DEFAULT_SKIP = 0;

type NormalizedSetting = {
  key: StaffPositionSettingKey;
  value: Prisma.InputJsonValue;
};

@Injectable()
export class StaffPositionService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Разбор значений идёт по каталогу: ключ вне каталога и значение не того типа
   * отклоняем здесь, потому что сервис зовут и мимо GraphQL.
   */
  private normalizeSettings(
    settings: StaffPositionSettingInput[] | null | undefined,
  ): NormalizedSetting[] {
    const normalized = new Map<
      StaffPositionSettingKey,
      Prisma.InputJsonValue
    >();

    for (const setting of settings ?? []) {
      const definition = getStaffPositionSettingDefinition(setting.key);
      if (!definition) {
        throw new BadRequestException(
          `Неизвестная настройка должности: ${String(setting.key)}`,
        );
      }

      // Пустое значение означает «настройка снята»: строку просто не пишем.
      if (setting.value === null || setting.value === undefined) continue;

      let value: Prisma.InputJsonValue;
      try {
        value = definition.parse(setting.value);
      } catch (error) {
        const reason =
          error instanceof Error ? error.message : 'неверное значение';
        throw new BadRequestException(
          `Настройка «${definition.label}»: ${reason}`,
        );
      }

      // Строка есть — настройка включена, поэтому false не храним.
      if (
        definition.type === StaffPositionSettingType.BOOLEAN &&
        value === false
      ) {
        continue;
      }

      normalized.set(setting.key, value);
    }

    return [...normalized].map(([key, value]) => ({ key, value }));
  }

  /** Имя свободно, если его не занимает другая активная должность. Архив не мешает. */
  private async assertNameIsFree(
    ctx: AuthContext,
    name: string,
    exceptId?: string,
  ): Promise<void> {
    const duplicate = await this.prisma.staffPosition.findFirst({
      where: {
        tenantId: ctx.tenantId,
        name,
        archivedAt: null,
        ...(exceptId ? { id: { not: exceptId } } : {}),
      },
    });
    if (duplicate) {
      throw new ConflictException(`Должность «${name}» уже есть`);
    }
  }

  private async withUniqueNameGuard<T>(name: string, run: () => Promise<T>) {
    try {
      return await run();
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(`Должность «${name}» уже есть`);
      }
      throw error;
    }
  }

  async findMany(
    ctx: AuthContext,
    {
      take = DEFAULT_TAKE,
      skip = DEFAULT_SKIP,
      search,
      includeArchived = false,
    }: {
      take?: number;
      skip?: number;
      search?: string;
      includeArchived?: boolean;
    },
  ) {
    const where = {
      tenantId: ctx.tenantId,
      ...(includeArchived ? {} : { archivedAt: null }),
      ...(search
        ? { name: { contains: search, mode: 'insensitive' as const } }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.staffPosition.findMany({
        where,
        take: +take,
        skip: +skip,
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        include: STAFF_POSITION_INCLUDE,
      }),
      this.prisma.staffPosition.count({ where }),
    ]);

    return { items: items.map(toStaffPositionModel), total };
  }

  async findOne(ctx: AuthContext, id: string) {
    const position = await this.prisma.staffPosition.findFirst({
      where: { id, tenantId: ctx.tenantId },
      include: STAFF_POSITION_INCLUDE,
    });
    return position ? toStaffPositionModel(position) : null;
  }

  async create(ctx: AuthContext, input: CreateStaffPositionInput) {
    const name = input.name.trim();
    if (!name) throw new BadRequestException('Название обязательно');
    await this.assertNameIsFree(ctx, name);

    return this.withUniqueNameGuard(name, async () => {
      const position = await this.prisma.staffPosition.create({
        data: {
          name,
          sortOrder: input.sortOrder ?? 0,
          tenantId: ctx.tenantId,
          createdBy: ctx.userId,
        },
        include: STAFF_POSITION_INCLUDE,
      });
      return toStaffPositionModel(position);
    });
  }

  async update(ctx: AuthContext, input: UpdateStaffPositionInput) {
    const existing = await this.prisma.staffPosition.findFirst({
      where: { id: input.id, tenantId: ctx.tenantId },
    });
    if (!existing) throw new NotFoundException('Должность не найдена');
    if (existing.archivedAt) {
      throw new BadRequestException(
        'Архивную должность нельзя изменить. Сначала верните её из архива',
      );
    }

    const data: { name?: string; sortOrder?: number } = {};

    if (input.name !== undefined) {
      const name = input.name.trim();
      if (!name) throw new BadRequestException('Название обязательно');
      await this.assertNameIsFree(ctx, name, input.id);
      data.name = name;
    }
    if (input.sortOrder !== undefined) data.sortOrder = input.sortOrder;

    const settings =
      input.settings === undefined
        ? undefined
        : this.normalizeSettings(input.settings);

    const nameForConflict = data.name ?? existing.name;
    return this.withUniqueNameGuard(nameForConflict, async () => {
      const position = await this.prisma.$transaction(async (tx) => {
        if (settings !== undefined) {
          await tx.staffPositionSetting.deleteMany({
            where: { positionId: input.id },
          });
          if (settings.length > 0) {
            await tx.staffPositionSetting.createMany({
              data: settings.map(({ key, value }) => ({
                positionId: input.id,
                key,
                value,
              })),
            });
          }
        }
        return tx.staffPosition.update({
          where: { id: input.id },
          data,
          include: STAFF_POSITION_INCLUDE,
        });
      });
      return toStaffPositionModel(position);
    });
  }

  /**
   * Должность, которую уже носили, не удаляем физически — архивируем,
   * иначе в карточке уволенного пропадёт, кем он работал.
   */
  async remove(ctx: AuthContext, id: string) {
    const existing = await this.prisma.staffPosition.findFirst({
      where: { id, tenantId: ctx.tenantId },
      include: STAFF_POSITION_INCLUDE,
    });
    if (!existing) throw new NotFoundException('Должность не найдена');
    if (existing.archivedAt) {
      return toStaffPositionModel(existing);
    }

    const activeCount = await this.prisma.employeeStaffPosition.count({
      where: { positionId: id, employee: { firedAt: null } },
    });
    if (activeCount > 0) {
      throw new ConflictException(
        `Нельзя удалить: должность назначена действующим сотрудникам (${activeCount}). Сначала снимите её с людей`,
      );
    }

    const linkedCount = await this.prisma.employeeStaffPosition.count({
      where: { positionId: id },
    });
    if (linkedCount > 0) {
      return this.setArchived(id, new Date());
    }

    await this.prisma.staffPosition.delete({ where: { id } });
    return toStaffPositionModel(existing);
  }

  async unarchive(ctx: AuthContext, id: string) {
    const existing = await this.prisma.staffPosition.findFirst({
      where: { id, tenantId: ctx.tenantId },
      include: STAFF_POSITION_INCLUDE,
    });
    if (!existing) throw new NotFoundException('Должность не найдена');
    if (!existing.archivedAt) {
      return toStaffPositionModel(existing);
    }
    await this.assertNameIsFree(ctx, existing.name, existing.id);
    return this.withUniqueNameGuard(existing.name, () =>
      this.setArchived(id, null),
    );
  }

  private async setArchived(id: string, archivedAt: Date | null) {
    const position = await this.prisma.staffPosition.update({
      where: { id },
      data: { archivedAt },
      include: STAFF_POSITION_INCLUDE,
    });
    return toStaffPositionModel(position);
  }
}
