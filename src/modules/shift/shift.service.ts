import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import type { AuthContext } from 'src/common/user-id.store';
import { STAFF_POSITION_INCLUDE } from 'src/modules/staff-position/staff-position.mapper';
import { isShiftDayKind } from './enums/shift-day-kind.enum';
import { ShiftDayModel } from './models/shift-day.model';
import {
  SetShiftDaysInput,
  ShiftDaysRangeInput,
} from './inputs/shift-day.input';
import {
  eachDateKey,
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

    const overrideByCell = new Map(
      overrides.map((override) => [
        `${override.employeeId}:${toDateKey(override.date)}`,
        override,
      ]),
    );

    const keys = eachDateKey(from, to);
    const days: ShiftDayModel[] = [];

    for (const employee of employees) {
      const positions = employee.staffPositions.map((link) => link.position);
      const canHoldColumn = occupiesCalendarColumn(positions);
      const hiredOn = toDayNumber(employee.hiredAt);
      const firedOn = employee.firedAt ? toDayNumber(employee.firedAt) : null;

      for (const key of keys) {
        const date = parseDateKey(key);
        const override = overrideByCell.get(`${employee.id}:${key}`);
        const kind =
          override && isShiftDayKind(override.kind) ? override.kind : null;
        const resolved = resolveShiftDay(employee, date, kind);

        const dayNumber = toDayNumber(date);
        const employed =
          dayNumber >= hiredOn && (firedOn === null || dayNumber <= firedOn);
        const working = resolved.working && employed;

        days.push({
          employeeId: employee.id,
          date: key,
          working,
          kind: resolved.kind,
          comment: override?.comment ?? null,
          occupiesColumn: working && canHoldColumn,
        });
      }
    }

    return days;
  }

  /** Сколько людей занимают колонки в каждый день диапазона. Ключ — ГГГГ-ММ-ДД. */
  async countColumnHoldersByDay(
    tenantId: string,
    from: Date,
    to: Date,
  ): Promise<Map<string, number>> {
    const days = await this.computeDays(tenantId, {
      from: toDateKey(from),
      to: toDateKey(to),
    });

    const counts = new Map<string, number>();
    for (const day of days) {
      if (!day.occupiesColumn) continue;
      counts.set(day.date, (counts.get(day.date) ?? 0) + 1);
    }
    return counts;
  }

  async setDays(
    ctx: AuthContext,
    input: SetShiftDaysInput,
  ): Promise<ShiftDayModel[]> {
    const { from, to } = this.parseRange(input.from, input.to);
    await this.assertEmployee(ctx, input.employeeId);

    const comment = input.comment?.trim() || null;
    const dates = eachDateKey(from, to).map(parseDateKey);

    // Отметка на день одна, поэтому диапазон переписываем целиком.
    await this.prisma.$transaction([
      this.prisma.employeeShiftDay.deleteMany({
        where: {
          employeeId: input.employeeId,
          tenantId: ctx.tenantId,
          date: { gte: from, lte: to },
        },
      }),
      this.prisma.employeeShiftDay.createMany({
        data: dates.map((date) => ({
          employeeId: input.employeeId,
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

  /** Снятие отметок возвращает дни в цикл, а не делает их выходными. */
  async clearDays(
    ctx: AuthContext,
    input: ShiftDaysRangeInput,
  ): Promise<ShiftDayModel[]> {
    const { from, to } = this.parseRange(input.from, input.to);
    await this.assertEmployee(ctx, input.employeeId);

    await this.prisma.employeeShiftDay.deleteMany({
      where: {
        employeeId: input.employeeId,
        tenantId: ctx.tenantId,
        date: { gte: from, lte: to },
      },
    });

    return this.findDays(ctx, {
      from: input.from,
      to: input.to,
      employeeId: input.employeeId,
    });
  }
}
