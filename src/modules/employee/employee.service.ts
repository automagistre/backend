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
import type { EmployeePositionInput } from './inputs/employee-position.input';
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

/** Маска и якорь наружу идут одним объектом: по отдельности они бессмысленны. */
function toShiftPatternModel({
  shiftMask,
  shiftStartsOn,
}: ShiftPatternColumns) {
  return shiftMask && shiftStartsOn
    ? { mask: shiftMask, startsOn: toDateKey(shiftStartsOn) }
    : null;
}

/** Связку через линк-таблицу наружу не показываем — только должности и их циклы. */
function toEmployeeModel<
  T extends {
    staffPositions: ({
      position: StaffPositionWithSettings;
      positionId: string;
    } & ShiftPatternColumns)[];
  },
>({ staffPositions, ...employee }: T) {
  return {
    ...employee,
    positions: staffPositions.map((link) =>
      toStaffPositionModel(link.position),
    ),
    positionShifts: staffPositions.map((link) => ({
      positionId: link.positionId,
      shift: toShiftPatternModel(link),
    })),
  };
}

const NO_SHIFT: ShiftPatternColumns = { shiftMask: null, shiftStartsOn: null };

/** Проверенный набор должностей (undefined — не менять) и циклы, которые надо записать. */
type PositionPlan = {
  positionIds: string[] | undefined;
  shifts: Map<string, ShiftPatternColumns>;
};

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

  /** null и undefined — набор не менять; цикл пишется только там, где передан. */
  private async resolvePositionPlan(
    ctx: AuthContext,
    positions: EmployeePositionInput[] | null | undefined,
    currentIds: string[],
  ): Promise<PositionPlan> {
    const shifts = new Map<string, ShiftPatternColumns>();
    if (positions == null) return { positionIds: undefined, shifts };

    const positionIds = await this.resolvePositionIds(
      ctx,
      positions.map((position) => position.positionId),
      currentIds,
    );
    for (const { positionId, shift } of positions) {
      const pattern = this.resolveShiftPattern(shift);
      if (pattern) shifts.set(positionId, pattern);
    }
    return { positionIds, shifts };
  }

  async create(ctx: AuthContext, data: CreateEmployeeInput) {
    const guaranteedMinimumAmount = await this.resolveGuaranteedMinimum(
      ctx.tenantId,
      data.guaranteedMinimumAmount,
    );
    const { positionIds = [], shifts } = await this.resolvePositionPlan(
      ctx,
      data.positions,
      [],
    );

    return this.prisma.$transaction(async (tx) => {
      const employee = await tx.employee.create({
        data: {
          personId: data.personId,
          ratio: data.ratio ?? null,
          excludeFromDashboard: data.excludeFromDashboard ?? false,
          salaryOnly: data.salaryOnly ?? false,
          hiredAt: data.hiredAt || new Date(),
          ...(guaranteedMinimumAmount !== undefined
            ? { guaranteedMinimumAmount }
            : {}),
          tenantId: ctx.tenantId,
          createdBy: ctx.userId,
          staffPositions: {
            create: positionIds.map((positionId) => ({
              positionId,
              ...shifts.get(positionId),
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
      positions,
      ratio,
      ...rest
    } = data;
    const updateData: Record<string, unknown> = Object.fromEntries(
      Object.entries(rest).filter(([, value]) => value !== null),
    );

    // Отдельно от фильтра выше: null здесь означает «снять процент», а не «не менять».
    if (ratio !== undefined) {
      updateData.ratio = ratio;
    }

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
    const plan = await this.resolvePositionPlan(ctx, positions, currentIds);
    const nextIds = plan.positionIds ?? currentIds;
    const removedIds = currentIds.filter(
      (positionId) => !nextIds.includes(positionId),
    );
    const addedIds = nextIds.filter(
      (positionId) => !currentIds.includes(positionId),
    );

    return this.prisma.$transaction(async (tx) => {
      // Связки не пересоздаём: на них живут цикл и отметки графика оставшихся должностей
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
            ...plan.shifts.get(positionId),
          })),
        });
      }
      for (const [positionId, pattern] of plan.shifts) {
        if (addedIds.includes(positionId)) continue;
        await tx.employeeStaffPosition.update({
          where: { employeeId_positionId: { employeeId: id, positionId } },
          data: pattern,
        });
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

  /** Цикл одной должности — для правки из графика, не трогая остальную карточку. */
  async setPositionShift(
    ctx: AuthContext,
    employeeId: string,
    positionId: string,
    shift: ShiftPatternInput | null,
  ) {
    const link = await this.prisma.employeeStaffPosition.findFirst({
      where: { employeeId, positionId, employee: { tenantId: ctx.tenantId } },
      include: { employee: { select: { firedAt: true } } },
    });
    if (!link) {
      throw new NotFoundException('У сотрудника нет такой должности');
    }
    if (link.employee.firedAt) {
      throw new BadRequestException('Сотрудник уволен, график не меняем');
    }

    const employee = await this.prisma.$transaction(async (tx) => {
      await tx.employeeStaffPosition.update({
        where: { employeeId_positionId: { employeeId, positionId } },
        data: this.resolveShiftPattern(shift) ?? NO_SHIFT,
      });
      return tx.employee.findUniqueOrThrow({
        where: { id: employeeId },
        include: EMPLOYEE_INCLUDE,
      });
    });
    return toEmployeeModel(employee);
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

    const [orderCount, salaryCount, snapshotCount] = await Promise.all([
      this.prisma.order.count({ where: { assigneeId: existing.personId } }),
      this.prisma.employeeSalary.count({ where: { employeeId: id } }),
      this.prisma.shiftSnapshotMember.count({ where: { employeeId: id } }),
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

    if (snapshotCount > 0) {
      throw new ConflictException(
        'Нельзя удалить: сотрудник был в смене при продажах — уволите его вместо удаления',
      );
    }

    await this.prisma.employee.delete({ where: { id } });
    return toEmployeeModel(existing);
  }
}
