import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  CreateEmployeeInput,
  UpdateEmployeeInput,
} from './inputs/employee.input';
import type { AuthContext } from 'src/common/user-id.store';
import { SettingsService } from 'src/modules/settings/settings.service';
import { applyDefaultCurrency } from 'src/common/money';
import type { MoneyInput } from 'src/common/inputs/money.input';
import {
  STAFF_POSITION_INCLUDE,
  toStaffPositionModel,
  type StaffPositionWithSettings,
} from 'src/modules/staff-position/staff-position.mapper';
import type { ShiftPatternInput } from 'src/modules/shift/inputs/shift-pattern.input';
import {
  assertShiftPattern,
  parseDateKey,
  pickPrimaryLink,
  toDateKey,
} from 'src/modules/shift/shift.rules';

const DEFAULT_TAKE = 25;
const DEFAULT_SKIP = 0;

const EMPLOYEE_INCLUDE = {
  person: true,
  staffPositions: {
    include: { position: { include: STAFF_POSITION_INCLUDE } },
    orderBy: { position: { sortOrder: 'asc' as const } },
  },
} as const;

type ShiftPatternColumns = {
  shiftMask: string | null;
  shiftStartsOn: Date | null;
};

/**
 * Связку через линк-таблицу наружу не показываем — только список должностей.
 * Маска и якорь наружу идут одним объектом: по отдельности они бессмысленны.
 * Цикл сотрудника пока один — это цикл основной должности.
 */
function toEmployeeModel<
  T extends {
    staffPositions: ({
      position: StaffPositionWithSettings;
    } & ShiftPatternColumns)[];
  },
>({ staffPositions, ...employee }: T) {
  const primary = pickPrimaryLink(staffPositions);
  return {
    ...employee,
    positions: staffPositions.map((link) =>
      toStaffPositionModel(link.position),
    ),
    shift:
      primary?.shiftMask && primary.shiftStartsOn
        ? {
            mask: primary.shiftMask,
            startsOn: toDateKey(primary.shiftStartsOn),
          }
        : null,
  };
}

const NO_SHIFT: ShiftPatternColumns = { shiftMask: null, shiftStartsOn: null };

@Injectable()
export class EmployeeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settingsService: SettingsService,
  ) {}

  private async resolveGuaranteedMinimum(
    tenantId: string,
    value: MoneyInput | null | undefined,
  ): Promise<bigint | null | undefined> {
    if (value === undefined) return undefined;
    if (value === null) return null;
    const defaultCurrency =
      await this.settingsService.getDefaultCurrencyCode(tenantId);
    const money = applyDefaultCurrency(value, defaultCurrency);
    return money.amountMinor > 0n ? money.amountMinor : null;
  }

  /** null — снять цикл, undefined — не трогать. Разбор здесь, чтобы в базу шла уже дата. */
  private resolveShiftPattern(
    shift: ShiftPatternInput | null | undefined,
  ): ShiftPatternColumns | undefined {
    if (shift === undefined) return undefined;
    if (shift === null) return NO_SHIFT;

    const mask = shift.mask.trim();
    try {
      const startsOn = parseDateKey(shift.startsOn);
      assertShiftPattern(mask, startsOn);
      return { shiftMask: mask, shiftStartsOn: startsOn };
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error ? error.message : 'Неверный график',
      );
    }
  }

  /**
   * Новые назначения — только активные должности.
   * Уже висящие на сотруднике архивные оставляем: иначе карточка уволенного
   * не сохранится и сотрёт, кем он работал.
   */
  private async resolvePositionIds(
    ctx: AuthContext,
    positionIds: string[] | null | undefined,
    alreadyAssignedIds: string[] = [],
  ): Promise<string[]> {
    const unique = [...new Set(positionIds ?? [])];
    if (unique.length === 0) return [];

    const alreadyAssigned = new Set(alreadyAssignedIds);
    const freshIds = unique.filter((id) => !alreadyAssigned.has(id));
    const keptIds = unique.filter((id) => alreadyAssigned.has(id));

    const [freshCount, keptCount] = await Promise.all([
      freshIds.length === 0
        ? Promise.resolve(0)
        : this.prisma.staffPosition.count({
            where: {
              id: { in: freshIds },
              tenantId: ctx.tenantId,
              archivedAt: null,
            },
          }),
      keptIds.length === 0
        ? Promise.resolve(0)
        : this.prisma.staffPosition.count({
            where: { id: { in: keptIds }, tenantId: ctx.tenantId },
          }),
    ]);

    if (freshCount !== freshIds.length || keptCount !== keptIds.length) {
      throw new BadRequestException(
        'Должность не найдена или находится в архиве',
      );
    }
    return unique;
  }

  /** Цикл хранится на должности: без должности его некуда положить. */
  private async resolvePrimaryPositionId(
    ctx: AuthContext,
    positionIds: string[],
    shift: ShiftPatternColumns | undefined,
  ): Promise<string | null> {
    if (shift === undefined) return null;
    const positions =
      positionIds.length === 0
        ? []
        : await this.prisma.staffPosition.findMany({
            where: { id: { in: positionIds }, tenantId: ctx.tenantId },
            select: { id: true, sortOrder: true },
          });
    const primary = pickPrimaryLink(
      positions.map((position) => ({ position })),
    );
    if (!primary && shift.shiftMask) {
      throw new BadRequestException(
        'Цикл графика задаётся для должности: назначьте сотруднику должность',
      );
    }
    return primary?.position.id ?? null;
  }

  async create(ctx: AuthContext, data: CreateEmployeeInput) {
    const guaranteedMinimumAmount = await this.resolveGuaranteedMinimum(
      ctx.tenantId,
      data.guaranteedMinimumAmount,
    );
    const positionIds = await this.resolvePositionIds(ctx, data.positionIds);
    const shift = this.resolveShiftPattern(data.shift);
    const primaryPositionId = await this.resolvePrimaryPositionId(
      ctx,
      positionIds,
      shift,
    );

    return this.prisma.$transaction(async (tx) => {
      const employee = await tx.employee.create({
        data: {
          personId: data.personId,
          ratio: data.ratio ?? null,
          hiredAt: data.hiredAt || new Date(),
          ...(guaranteedMinimumAmount !== undefined
            ? { guaranteedMinimumAmount }
            : {}),
          tenantId: ctx.tenantId,
          createdBy: ctx.userId,
          staffPositions: {
            create: positionIds.map((positionId) => ({
              positionId,
              ...(positionId === primaryPositionId ? shift : {}),
            })),
          },
        },
      });
      await tx.person.update({
        where: { id: data.personId },
        data: { contractor: true },
      });
      const created = await tx.employee.findUniqueOrThrow({
        where: { id: employee.id },
        include: EMPLOYEE_INCLUDE,
      });
      return toEmployeeModel(created);
    });
  }

  async update(ctx: AuthContext, { id, ...data }: UpdateEmployeeInput) {
    const existing = await this.prisma.employee.findFirst({
      where: { id, tenantId: ctx.tenantId },
    });
    if (!existing) {
      throw new NotFoundException('Сотрудник не найден или недоступен');
    }

    const {
      guaranteedMinimumAmount: guaranteeInput,
      positionIds,
      ratio,
      shift,
      ...rest
    } = data;
    const updateData: Record<string, unknown> = Object.fromEntries(
      Object.entries(rest).filter(([, value]) => value !== null),
    );

    // Отдельно от фильтра выше: null здесь означает «снять процент», а не «не менять».
    if (ratio !== undefined) {
      updateData.ratio = ratio;
    }

    const nextShift = this.resolveShiftPattern(shift);

    if (guaranteeInput !== undefined) {
      updateData.guaranteedMinimumAmount = await this.resolveGuaranteedMinimum(
        ctx.tenantId,
        guaranteeInput,
      );
    }

    const currentIds = (
      await this.prisma.employeeStaffPosition.findMany({
        where: { employeeId: id },
        select: { positionId: true },
      })
    ).map((link) => link.positionId);
    const nextPositionIds =
      positionIds === undefined
        ? undefined
        : await this.resolvePositionIds(ctx, positionIds, currentIds);
    const primaryPositionId = await this.resolvePrimaryPositionId(
      ctx,
      nextPositionIds ?? currentIds,
      nextShift,
    );

    return this.prisma.$transaction(async (tx) => {
      // Связки не пересоздаём: на них живут цикл и отметки графика оставшихся должностей
      if (nextPositionIds !== undefined) {
        const removedIds = currentIds.filter(
          (positionId) => !nextPositionIds.includes(positionId),
        );
        const addedIds = nextPositionIds.filter(
          (positionId) => !currentIds.includes(positionId),
        );
        if (removedIds.length > 0) {
          await tx.employeeStaffPosition.deleteMany({
            where: { employeeId: id, positionId: { in: removedIds } },
          });
        }
        if (addedIds.length > 0) {
          await tx.employeeStaffPosition.createMany({
            data: addedIds.map((positionId) => ({
              employeeId: id,
              positionId,
            })),
          });
        }
      }

      // Цикл пока один на сотрудника: живёт на основной должности, у остальных снят
      if (nextShift !== undefined) {
        await tx.employeeStaffPosition.updateMany({
          where: { employeeId: id },
          data: NO_SHIFT,
        });
        if (primaryPositionId) {
          await tx.employeeStaffPosition.update({
            where: {
              employeeId_positionId: {
                employeeId: id,
                positionId: primaryPositionId,
              },
            },
            data: nextShift,
          });
        }
      }

      const employee = await tx.employee.update({
        where: { id },
        data: updateData,
        include: EMPLOYEE_INCLUDE,
      });
      return toEmployeeModel(employee);
    });
  }

  async findMany(
    ctx: AuthContext,
    {
      take = DEFAULT_TAKE,
      skip = DEFAULT_SKIP,
      search,
      includeFired = false,
    }: {
      take?: number;
      skip?: number;
      search?: string;
      includeFired?: boolean;
    },
  ) {
    const personFilter = {
      tenantGroupId: ctx.tenantGroupId,
      ...(search
        ? {
            OR: [
              { firstname: { contains: search, mode: 'insensitive' as const } },
              { lastname: { contains: search, mode: 'insensitive' as const } },
              { telephone: { contains: search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };

    const where = {
      tenantId: ctx.tenantId,
      ...(includeFired ? {} : { firedAt: null }),
      person: personFilter,
    };

    const [items, total] = await Promise.all([
      this.prisma.employee.findMany({
        where,
        take: +take,
        skip: +skip,
        include: EMPLOYEE_INCLUDE,
        orderBy: {
          person: {
            lastname: 'asc',
          },
        },
      }),
      this.prisma.employee.count({ where }),
    ]);

    return { items: items.map(toEmployeeModel), total };
  }

  async findOne(ctx: AuthContext, id: string) {
    const employee = await this.prisma.employee.findFirst({
      where: {
        id,
        tenantId: ctx.tenantId,
        person: { tenantGroupId: ctx.tenantGroupId },
      },
      include: EMPLOYEE_INCLUDE,
    });
    return employee ? toEmployeeModel(employee) : null;
  }

  async findByPersonId(ctx: AuthContext, personId: string) {
    const employee = await this.prisma.employee.findFirst({
      where: {
        personId,
        tenantId: ctx.tenantId,
        person: { tenantGroupId: ctx.tenantGroupId },
      },
      orderBy: { firedAt: { sort: 'asc', nulls: 'first' } },
      include: EMPLOYEE_INCLUDE,
    });
    return employee ? toEmployeeModel(employee) : null;
  }

  async resolvePersonIdByEmployeeId(
    ctx: AuthContext,
    employeeId: string | null,
  ): Promise<string | null> {
    if (!employeeId) return null;
    const employee = await this.findOne(ctx, employeeId);
    return employee?.personId ?? null;
  }

  async resolveEmployeeIdByPersonId(
    ctx: AuthContext,
    personId: string | null,
  ): Promise<string | null> {
    if (!personId) return null;
    const employee = await this.findByPersonId(ctx, personId);
    return employee?.id ?? null;
  }

  async fire(ctx: AuthContext, id: string) {
    const existing = await this.prisma.employee.findFirst({
      where: { id, tenantId: ctx.tenantId },
    });
    if (!existing) {
      throw new NotFoundException('Сотрудник не найден или недоступен');
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.employee.update({
        where: { id },
        data: { firedAt: new Date() },
      });
      await tx.person.update({
        where: { id: existing.personId },
        data: { contractor: false },
      });
      const fired = await tx.employee.findUniqueOrThrow({
        where: { id },
        include: EMPLOYEE_INCLUDE,
      });
      return toEmployeeModel(fired);
    });
  }

  async remove(ctx: AuthContext, id: string) {
    const existing = await this.prisma.employee.findFirst({
      where: { id, tenantId: ctx.tenantId },
      include: EMPLOYEE_INCLUDE,
    });
    if (!existing) {
      throw new NotFoundException('Сотрудник не найден или недоступен');
    }

    const [orderCount, salaryCount] = await Promise.all([
      this.prisma.order.count({ where: { assigneeId: existing.personId } }),
      this.prisma.employeeSalary.count({ where: { employeeId: id } }),
    ]);

    if (orderCount > 0) {
      throw new ConflictException(
        `Нельзя удалить: есть ${orderCount} связанных заказов`,
      );
    }

    if (salaryCount > 0) {
      throw new ConflictException(
        `Нельзя удалить: есть ${salaryCount} записей о зарплате`,
      );
    }

    await this.prisma.employee.delete({ where: { id } });
    return toEmployeeModel(existing);
  }
}
