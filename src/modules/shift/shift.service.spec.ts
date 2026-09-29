import { BadRequestException } from '@nestjs/common';
import { mockDeep, type DeepMockProxy } from 'jest-mock-extended';
import { PrismaService } from 'src/prisma/prisma.service';
import type { AuthContext } from 'src/common/user-id.store';
import { StaffPositionSettingKey } from 'src/modules/staff-position/enums/staff-position-setting.enum';
import { ShiftDayKind } from './enums/shift-day-kind.enum';
import { ShiftService } from './shift.service';
import { parseDateKey } from './shift.rules';

const { CALENDAR_PARTICIPANT, WORK_EXECUTOR } = StaffPositionSettingKey;

const ctx: AuthContext = {
  userId: 'u',
  tenantId: 'tenant-1',
  tenantGroupId: 'group-1',
};

// 2026-09-07 — понедельник
const MONDAY = '2026-09-07';
const SATURDAY = '2026-09-12';

function link(
  positionId: string,
  shiftMask: string | null,
  settings: StaffPositionSettingKey[] = [],
) {
  return {
    employeeId: 'emp-1',
    positionId,
    shiftMask,
    shiftStartsOn: shiftMask ? parseDateKey(MONDAY) : null,
    position: {
      id: positionId,
      sortOrder: 0,
      settings: settings.map((key) => ({ positionId, key, value: true })),
    },
  };
}

function employee(staffPositions: ReturnType<typeof link>[], id = 'emp-1') {
  return {
    id,
    tenantId: 'tenant-1',
    hiredAt: parseDateKey('2026-01-01'),
    firedAt: null,
    staffPositions: staffPositions.map((item) => ({
      ...item,
      employeeId: id,
    })),
  };
}

function mark(
  kind: ShiftDayKind,
  date: string,
  positionId: string | null,
  employeeId = 'emp-1',
) {
  return {
    employeeId,
    positionId,
    date: parseDateKey(date),
    kind,
    comment: null,
  };
}

describe('ShiftService', () => {
  let prisma: DeepMockProxy<PrismaService>;
  let service: ShiftService;

  beforeEach(() => {
    prisma = mockDeep<PrismaService>();
    service = new ShiftService(prisma);
  });

  function given(employees: unknown[], marks: unknown[] = []) {
    jest.mocked(prisma.employee.findMany).mockResolvedValue(employees as any);
    jest
      .mocked(prisma.employeeShiftDay.findMany)
      .mockResolvedValue(marks as any);
  }

  const dayOf = (
    days: Awaited<ReturnType<ShiftService['findDays']>>,
    positionId: string | null,
    date: string,
  ) => days.find((day) => day.positionId === positionId && day.date === date);

  describe('findDays', () => {
    it('совместитель — строка на каждую должность со своим циклом', async () => {
      given([
        employee([link('pos-master', '1111100'), link('pos-parts', '0000011')]),
      ]);

      const days = await service.findDays(ctx, { from: MONDAY, to: SATURDAY });

      expect(days).toHaveLength(12);
      expect(dayOf(days, 'pos-master', MONDAY)?.working).toBe(true);
      expect(dayOf(days, 'pos-parts', MONDAY)?.working).toBe(false);
      expect(dayOf(days, 'pos-master', SATURDAY)?.working).toBe(false);
      expect(dayOf(days, 'pos-parts', SATURDAY)?.working).toBe(true);
    });

    it('отпуск гасит все строки сотрудника', async () => {
      given(
        [
          employee([
            link('pos-master', '1111111'),
            link('pos-parts', '1111111'),
          ]),
        ],
        [mark(ShiftDayKind.VACATION, MONDAY, null)],
      );

      const days = await service.findDays(ctx, { from: MONDAY, to: MONDAY });

      expect(
        days.map((day) => [day.positionId, day.working, day.kind]),
      ).toEqual([
        ['pos-master', false, ShiftDayKind.VACATION],
        ['pos-parts', false, ShiftDayKind.VACATION],
      ]);
    });

    it('выход вне графика ставится только одной должности', async () => {
      given(
        [employee([link('pos-master', null), link('pos-parts', null)])],
        [mark(ShiftDayKind.WORK, MONDAY, 'pos-parts')],
      );

      const days = await service.findDays(ctx, { from: MONDAY, to: MONDAY });

      expect(dayOf(days, 'pos-master', MONDAY)).toMatchObject({
        working: false,
        kind: null,
      });
      expect(dayOf(days, 'pos-parts', MONDAY)).toMatchObject({
        working: true,
        kind: ShiftDayKind.WORK,
      });
    });

    it('без должности — одна строка без цикла, видны только отпуск и больничный', async () => {
      given([employee([])], [mark(ShiftDayKind.SICK, MONDAY, null)]);

      const days = await service.findDays(ctx, {
        from: MONDAY,
        to: '2026-09-08',
      });

      expect(days).toEqual([
        expect.objectContaining({
          positionId: null,
          date: MONDAY,
          working: false,
          kind: ShiftDayKind.SICK,
          occupiesColumn: false,
        }),
        expect.objectContaining({
          positionId: null,
          date: '2026-09-08',
          working: false,
          kind: null,
        }),
      ]);
    });

    it('колонку даёт только должность, у которой обе настройки', async () => {
      given([
        employee([
          link('pos-master', '1111111', [CALENDAR_PARTICIPANT, WORK_EXECUTOR]),
          link('pos-parts', '1111111', [WORK_EXECUTOR]),
        ]),
      ]);

      const days = await service.findDays(ctx, { from: MONDAY, to: MONDAY });

      expect(dayOf(days, 'pos-master', MONDAY)?.occupiesColumn).toBe(true);
      expect(dayOf(days, 'pos-parts', MONDAY)?.occupiesColumn).toBe(false);
    });
  });

  it('countColumnHoldersByDay считает людей, а не строки', async () => {
    const both = [CALENDAR_PARTICIPANT, WORK_EXECUTOR];
    given([
      employee([
        link('pos-master', '1111111', both),
        link('pos-lead', '1111111', both),
      ]),
      employee([link('pos-master', '1111100', both)], 'emp-2'),
    ]);

    const counts = await service.countColumnHoldersByDay(
      'tenant-1',
      parseDateKey(MONDAY),
      parseDateKey(SATURDAY),
    );

    expect(counts.get(MONDAY)).toBe(2);
    expect(counts.get(SATURDAY)).toBe(1);
  });

  describe('findWorkingPairs', () => {
    it('совместитель на смене в обеих ролях — две пары, выходной сотрудник — ни одной', async () => {
      given(
        [
          employee([link('pos-a', '1'), link('pos-b', '1')]),
          employee([link('pos-a', '1')], 'emp-2'),
          employee([], 'emp-3'),
        ],
        [mark(ShiftDayKind.DAY_OFF, MONDAY, 'pos-a', 'emp-2')],
      );

      await expect(
        service.findWorkingPairs('tenant-1', MONDAY),
      ).resolves.toEqual([
        { employeeId: 'emp-1', positionId: 'pos-a' },
        { employeeId: 'emp-1', positionId: 'pos-b' },
      ]);
    });

    it('отпуск снимает человека со всех должностей', async () => {
      given(
        [employee([link('pos-a', '1'), link('pos-b', '1')])],
        [mark(ShiftDayKind.VACATION, MONDAY, null)],
      );

      await expect(
        service.findWorkingPairs('tenant-1', MONDAY),
      ).resolves.toEqual([]);
    });
  });

  describe('setDays', () => {
    beforeEach(() => {
      jest
        .mocked(prisma.employee.findFirst)
        .mockResolvedValue(
          employee([link('pos-master', null), link('pos-parts', null)]) as any,
        );
      given([]);
    });

    const range = { employeeId: 'emp-1', from: MONDAY, to: MONDAY };

    it('выход без должности не ставится', async () => {
      await expect(
        service.setDays(ctx, { ...range, kind: ShiftDayKind.WORK }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('чужую должность не принимает', async () => {
      await expect(
        service.setDays(ctx, {
          ...range,
          kind: ShiftDayKind.DAY_OFF,
          positionId: 'pos-foreign',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('отпуск с должностью не ставится', async () => {
      await expect(
        service.setDays(ctx, {
          ...range,
          kind: ShiftDayKind.VACATION,
          positionId: 'pos-master',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('выход переписывает отметки своей должности и на человека', async () => {
      await service.setDays(ctx, {
        ...range,
        kind: ShiftDayKind.WORK,
        positionId: 'pos-parts',
      });

      expect(prisma.employeeShiftDay.deleteMany).toHaveBeenCalledWith({
        where: expect.objectContaining({
          employeeId: 'emp-1',
          OR: [{ positionId: 'pos-parts' }, { positionId: null }],
        }),
      });
      expect(prisma.employeeShiftDay.createMany).toHaveBeenCalledWith({
        data: [expect.objectContaining({ positionId: 'pos-parts' })],
      });
    });

    it('отпуск снимает все отметки сотрудника', async () => {
      await service.setDays(ctx, { ...range, kind: ShiftDayKind.VACATION });

      const [deleteArgs] = jest.mocked(prisma.employeeShiftDay.deleteMany).mock
        .calls[0];
      expect(deleteArgs?.where).not.toHaveProperty('OR');
      expect(prisma.employeeShiftDay.createMany).toHaveBeenCalledWith({
        data: [expect.objectContaining({ positionId: null })],
      });
    });
  });

  describe('clearDays', () => {
    beforeEach(() => {
      jest
        .mocked(prisma.employee.findFirst)
        .mockResolvedValue(employee([link('pos-master', null)]) as any);
      given([]);
    });

    it('в строке должности снимает её отметки и на человека', async () => {
      await service.clearDays(ctx, {
        employeeId: 'emp-1',
        from: MONDAY,
        to: MONDAY,
        positionId: 'pos-master',
      });

      expect(prisma.employeeShiftDay.deleteMany).toHaveBeenCalledWith({
        where: expect.objectContaining({
          OR: [{ positionId: 'pos-master' }, { positionId: null }],
        }),
      });
    });

    it('без должности снимает всё', async () => {
      await service.clearDays(ctx, {
        employeeId: 'emp-1',
        from: MONDAY,
        to: MONDAY,
      });

      const [deleteArgs] = jest.mocked(prisma.employeeShiftDay.deleteMany).mock
        .calls[0];
      expect(deleteArgs?.where).not.toHaveProperty('OR');
    });

    it('чужую должность не принимает', async () => {
      await expect(
        service.clearDays(ctx, {
          employeeId: 'emp-1',
          from: MONDAY,
          to: MONDAY,
          positionId: 'pos-foreign',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });
});
