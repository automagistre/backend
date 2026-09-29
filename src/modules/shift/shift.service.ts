import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import type { AuthContext } from 'src/common/user-id.store';
import { STAFF_POSITION_INCLUDE } from 'src/modules/staff-position/staff-position.mapper';
import { isShiftDayKind, ShiftDayKind } from './enums/shift-day-kind.enum';
import { ShiftDayModel } from './models/shift-day.model';
import {
  SetShiftDaysInput,
  ShiftDaysRangeInput,
} from './inputs/shift-day.input';
import {
  eachDateKey,
  isPersonLevelKind,
  occupiesCalendarColumn,
  parseDateKey,
  resolveShiftDay,
  toDateKey,
  toDayNumber,
} from './shift.rules';

/** Год — предел одного запроса: матрица рисуется месяцем, всё сверх этого явно ошибка. */
const MAX_RANGE_DAYS = 366;

const EMPLOYEE_SHIFT_INCLUDE = {
  staffPositions: {
    include: { position: { include: STAFF_POSITION_INCLUDE } },
  },
} as const;

@Injectable()
export class ShiftService {
  constructor(private readonly prisma: PrismaService) {}

  private parseRange(from: string, to: string): { from: Date; to: Date } {
    let start: Date;
    let end: Date;
    try {
      start = parseDateKey(from);
      end = parseDateKey(to);
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error ? error.message : 'Неверная дата',
      );
    }

    if (toDayNumber(end) < toDayNumber(start)) {
      throw new BadRequestException('Конец диапазона раньше начала');
    }
    if (toDayNumber(end) - toDayNumber(start) >= MAX_RANGE_DAYS) {
      throw new BadRequestException(
        `Диапазон не длиннее ${MAX_RANGE_DAYS} дней`,
      );
    }
    return { from: start, to: end };
  }

  private async assertEmployee(ctx: AuthContext, employeeId: string) {
    const employee = await this.prisma.employee.findFirst({
      where: { id: employeeId, tenantId: ctx.tenantId },
      include: { staffPositions: { include: { position: true } } },
    });
    if (!employee) throw new BadRequestException('Сотрудник не найден');
    if (employee.firedAt) {
      throw new BadRequestException('Сотрудник уволен, график не меняем');
    }
    return employee;
  }

  /**
   * Свод цикла и отметок за диапазон. Уволенных и ещё не нанятых оставляем в ответе,
   * но всегда вне смены: матрица за прошлый месяц должна читаться целиком.
   */
  async findDays(
    ctx: AuthContext,
    range: { from: string; to: string; employeeId?: string | null },
  ): Promise<ShiftDayModel[]> {
    return this.computeDays(ctx.tenantId, range);
  }

  private async computeDays(
    tenantId: string,
    range: { from: string; to: string; employeeId?: string | null },
  ): Promise<ShiftDayModel[]> {
    const { from, to } = this.parseRange(range.from, range.to);

    const [employees, overrides] = await Promise.all([
      this.prisma.employee.findMany({
        where: {
          tenantId,
          ...(range.employeeId ? { id: range.employeeId } : {}),
        },
        include: EMPLOYEE_SHIFT_INCLUDE,
      }),
      this.prisma.employeeShiftDay.findMany({
        where: {
          tenantId,
          date: { gte: from, lte: to },
          ...(range.employeeId ? { employeeId: range.employeeId } : {}),
        },
      }),
    ]);

    // Ключ ячейки: отметка на человека — без должности, на должность — с ней
    const overrideByCell = new Map(
      overrides.map((override) => [
        `${override.employeeId}:${override.positionId ?? ''}:${toDateKey(override.date)}`,
        override,
      ]),
    );

    const markAt = (key: string) => {
      const override = overrideByCell.get(key);
      return override && isShiftDayKind(override.kind)
        ? { kind: override.kind, comment: override.comment }
        : undefined;
    };

    const keys = eachDateKey(from, to);
    const days: ShiftDayModel[] = [];

    for (const employee of employees) {
      const hiredOn = toDayNumber(employee.hiredAt);
      const firedOn = employee.firedAt ? toDayNumber(employee.firedAt) : null;
      // Без должностей — одна строка без цикла: на ней видны только отпуск и больничный
      const rows = employee.staffPositions.length
        ? employee.staffPositions.map((link) => ({
            positionId: link.positionId,
            pattern: link,
            canHoldColumn: occupiesCalendarColumn(link.position),
          }))
        : [
            {
              positionId: null,
              pattern: { shiftMask: null, shiftStartsOn: null },
              canHoldColumn: false,
            },
          ];

      for (const key of keys) {
        const date = parseDateKey(key);
        const dayNumber = toDayNumber(date);
        const employed =
          dayNumber >= hiredOn && (firedOn === null || dayNumber <= firedOn);
        const personMark = markAt(`${employee.id}::${key}`);

        for (const row of rows) {
          const positionMark = row.positionId
            ? markAt(`${employee.id}:${row.positionId}:${key}`)
            : undefined;
          const resolved = resolveShiftDay(row.pattern, date, {
            personKind: personMark?.kind,
            positionKind: positionMark?.kind,
          });
          const working = resolved.working && employed;

          days.push({
            employeeId: employee.id,
            positionId: row.positionId,
            date: key,
            working,
            kind: resolved.kind,
            comment: (personMark ?? positionMark)?.comment ?? null,
            occupiesColumn: working && row.canHoldColumn,
          });
        }
      }
    }

    return days;
  }

  /**
   * Кто в какой должности работает в этот день — состав смены для снимка.
   * Совместитель в двух ролях даёт две пары; сотрудник без должностей в смену не входит.
   */
  async findWorkingPairs(
    tenantId: string,
    dateKey: string,
  ): Promise<{ employeeId: string; positionId: string }[]> {
    const days = await this.computeDays(tenantId, {
      from: dateKey,
      to: dateKey,
    });
    return days.flatMap((day) =>
      day.working && day.positionId
        ? [{ employeeId: day.employeeId, positionId: day.positionId }]
        : [],
    );
  }

  /**
   * Сколько людей занимают колонки в каждый день диапазона. Ключ — ГГГГ-ММ-ДД.
   * Считаем людей, а не строки: совместитель в двух ролях — всё равно одна колонка.
   */
  async countColumnHoldersByDay(
    tenantId: string,
    from: Date,
    to: Date,
  ): Promise<Map<string, number>> {
    const days = await this.computeDays(tenantId, {
      from: toDateKey(from),
      to: toDateKey(to),
    });

    const holders = new Map<string, Set<string>>();
    for (const day of days) {
      if (!day.occupiesColumn) continue;
      const employeeIds = holders.get(day.date) ?? new Set<string>();
      employeeIds.add(day.employeeId);
      holders.set(day.date, employeeIds);
    }
    return new Map(
      [...holders].map(([date, employeeIds]) => [date, employeeIds.size]),
    );
  }

  async setDays(
    ctx: AuthContext,
    input: SetShiftDaysInput,
  ): Promise<ShiftDayModel[]> {
    const { from, to } = this.parseRange(input.from, input.to);
    const employee = await this.assertEmployee(ctx, input.employeeId);
    const positionId = this.resolveMarkPositionId(
      input.kind,
      input.positionId,
      employee.staffPositions.map((link) => link.positionId),
    );

    const comment = input.comment?.trim() || null;
    const dates = eachDateKey(from, to).map(parseDateKey);

    // Отметка на человека перекрывает все его строки, поэтому забирает и отметки должностей.
    // Отметка на должность снимает отпуск или больничный: иначе она не была бы видна.
    await this.prisma.$transaction([
      this.prisma.employeeShiftDay.deleteMany({
        where: {
          employeeId: input.employeeId,
          tenantId: ctx.tenantId,
          date: { gte: from, lte: to },
          ...(positionId ? { OR: [{ positionId }, { positionId: null }] } : {}),
        },
      }),
      this.prisma.employeeShiftDay.createMany({
        data: dates.map((date) => ({
          employeeId: input.employeeId,
          positionId,
          date,
          kind: input.kind,
          comment,
          tenantId: ctx.tenantId,
          createdBy: ctx.userId,
        })),
      }),
    ]);

    return this.findDays(ctx, {
      from: input.from,
      to: input.to,
      employeeId: input.employeeId,
    });
  }

  /** Отпуск и больничный — на человека, выход и отгул — на должность: так их различает CHECK в базе. */
  private resolveMarkPositionId(
    kind: ShiftDayKind,
    positionId: string | null | undefined,
    employeePositionIds: string[],
  ): string | null {
    if (isPersonLevelKind(kind)) {
      if (positionId) {
        throw new BadRequestException(
          'Отпуск и больничный ставятся на человека, без должности',
        );
      }
      return null;
    }
    if (!positionId) {
      throw new BadRequestException(
        'Для выхода и отгула укажите должность сотрудника',
      );
    }
    this.assertEmployeePosition(positionId, employeePositionIds);
    return positionId;
  }

  private assertEmployeePosition(
    positionId: string,
    employeePositionIds: string[],
  ): void {
    if (!employeePositionIds.includes(positionId)) {
      throw new BadRequestException('У сотрудника нет такой должности');
    }
  }

  /** Снятие отметок возвращает дни в цикл, а не делает их выходными. */
  async clearDays(
    ctx: AuthContext,
    input: ShiftDaysRangeInput,
  ): Promise<ShiftDayModel[]> {
    const { from, to } = this.parseRange(input.from, input.to);
    const employee = await this.assertEmployee(ctx, input.employeeId);
    if (input.positionId) {
      this.assertEmployeePosition(
        input.positionId,
        employee.staffPositions.map((link) => link.positionId),
      );
    }

    // «По циклу» в строке должности: и её отметки, и отпуск с больничным — иначе строка не вернётся в цикл
    await this.prisma.employeeShiftDay.deleteMany({
      where: {
        employeeId: input.employeeId,
        tenantId: ctx.tenantId,
        date: { gte: from, lte: to },
        ...(input.positionId
          ? { OR: [{ positionId: input.positionId }, { positionId: null }] }
          : {}),
      },
    });

    return this.findDays(ctx, {
      from: input.from,
      to: input.to,
      employeeId: input.employeeId,
    });
  }
}
