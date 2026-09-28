import { StaffPositionSettingKey } from 'src/modules/staff-position/enums/staff-position-setting.enum';
import type { StaffPositionWithSettings } from 'src/modules/staff-position/staff-position.mapper';
import { ShiftDayKind } from './enums/shift-day-kind.enum';
import {
  assertShiftPattern,
  eachDateKey,
  isWorkingByPattern,
  occupiesCalendarColumn,
  parseDateKey,
  resolveShiftDay,
  toDateKey,
} from './shift.rules';

const day = (key: string) => parseDateKey(key);

function position(keys: StaffPositionSettingKey[]): StaffPositionWithSettings {
  return {
    id: 'pos',
    name: 'Должность',
    sortOrder: 0,
    archivedAt: null,
    tenantId: 'tenant',
    createdAt: null,
    createdBy: null,
    settings: keys.map((key) => ({ positionId: 'pos', key, value: true })),
  };
}

describe('parseDateKey и toDateKey', () => {
  it('ключ переживает разбор и сборку', () => {
    expect(toDateKey(day('2026-08-21'))).toBe('2026-08-21');
  });

  it('отклоняет мусор и несуществующую дату', () => {
    expect(() => parseDateKey('21.08.2026')).toThrow(/ГГГГ-ММ-ДД/);
    expect(() => parseDateKey('2026-02-30')).toThrow(/не существует/);
  });
});

describe('eachDateKey', () => {
  it('включает обе границы', () => {
    expect(eachDateKey(day('2026-08-30'), day('2026-09-01'))).toEqual([
      '2026-08-30',
      '2026-08-31',
      '2026-09-01',
    ]);
  });

  it('один день — один ключ', () => {
    expect(eachDateKey(day('2026-08-21'), day('2026-08-21'))).toEqual([
      '2026-08-21',
    ]);
  });
});

describe('assertShiftPattern', () => {
  it('пустой график допустим: сотрудник выходит по отметкам', () => {
    expect(() => assertShiftPattern(null, null)).not.toThrow();
  });

  it('маска без якоря и якорь без маски отклоняются', () => {
    expect(() => assertShiftPattern('11100', null)).toThrow(/дата/i);
    expect(() => assertShiftPattern(null, day('2026-08-21'))).toThrow(/цикл/i);
  });

  it('маска только из 1 и 0, не длиннее 31, хотя бы с одним рабочим днём', () => {
    const anchor = day('2026-08-21');
    expect(() => assertShiftPattern('11x00', anchor)).toThrow(/1 и 0/);
    expect(() => assertShiftPattern('1'.repeat(32), anchor)).toThrow(/31/);
    expect(() => assertShiftPattern('0000', anchor)).toThrow(/рабочий день/);
    expect(() => assertShiftPattern('1111100', anchor)).not.toThrow();
  });
});

describe('isWorkingByPattern', () => {
  const anchor = day('2026-08-17'); // понедельник

  it('5/2 закрывает будни и открывает выходные', () => {
    const mask = '1111100';
    expect(isWorkingByPattern(mask, anchor, day('2026-08-17'))).toBe(true);
    expect(isWorkingByPattern(mask, anchor, day('2026-08-21'))).toBe(true);
    expect(isWorkingByPattern(mask, anchor, day('2026-08-22'))).toBe(false);
    expect(isWorkingByPattern(mask, anchor, day('2026-08-23'))).toBe(false);
    expect(isWorkingByPattern(mask, anchor, day('2026-08-24'))).toBe(true);
  });

  it('4/4 повторяется через восемь дней', () => {
    const mask = '11110000';
    expect(isWorkingByPattern(mask, anchor, day('2026-08-20'))).toBe(true);
    expect(isWorkingByPattern(mask, anchor, day('2026-08-21'))).toBe(false);
    expect(isWorkingByPattern(mask, anchor, day('2026-08-25'))).toBe(true);
  });

  it('цикл читается и до даты якоря', () => {
    // Предыдущий виток начался 9 августа: 9–12 рабочие, 13–16 выходные.
    expect(isWorkingByPattern('11110000', anchor, day('2026-08-09'))).toBe(
      true,
    );
    expect(isWorkingByPattern('11110000', anchor, day('2026-08-12'))).toBe(
      true,
    );
    expect(isWorkingByPattern('11110000', anchor, day('2026-08-13'))).toBe(
      false,
    );
    expect(isWorkingByPattern('11110000', anchor, day('2026-08-16'))).toBe(
      false,
    );
  });

  it('без маски или якоря сотрудник не работает', () => {
    expect(isWorkingByPattern(null, anchor, day('2026-08-21'))).toBe(false);
    expect(isWorkingByPattern('1111100', null, day('2026-08-21'))).toBe(false);
  });
});

describe('resolveShiftDay', () => {
  const pattern = { shiftMask: '1111100', shiftStartsOn: day('2026-08-17') };

  it('без отметки идём по циклу', () => {
    expect(resolveShiftDay(pattern, day('2026-08-22'))).toEqual({
      working: false,
      kind: null,
    });
  });

  it('отпуск снимает рабочий день', () => {
    expect(
      resolveShiftDay(pattern, day('2026-08-21'), {
        personKind: ShiftDayKind.VACATION,
      }),
    ).toEqual({ working: false, kind: ShiftDayKind.VACATION });
  });

  it('выход вне графика добавляет смену в выходной', () => {
    expect(
      resolveShiftDay(pattern, day('2026-08-22'), {
        positionKind: ShiftDayKind.WORK,
      }),
    ).toEqual({ working: true, kind: ShiftDayKind.WORK });
  });

  it('отгул снимает рабочий день должности', () => {
    expect(
      resolveShiftDay(pattern, day('2026-08-21'), {
        positionKind: ShiftDayKind.DAY_OFF,
      }),
    ).toEqual({ working: false, kind: ShiftDayKind.DAY_OFF });
  });

  it('отметка на человека сильнее отметки на должность', () => {
    expect(
      resolveShiftDay(pattern, day('2026-08-22'), {
        personKind: ShiftDayKind.SICK,
        positionKind: ShiftDayKind.WORK,
      }),
    ).toEqual({ working: false, kind: ShiftDayKind.SICK });
  });

  it('без цикла работает только по отметке', () => {
    const onDemand = { shiftMask: null, shiftStartsOn: null };
    expect(resolveShiftDay(onDemand, day('2026-08-21'))).toEqual({
      working: false,
      kind: null,
    });
    expect(
      resolveShiftDay(onDemand, day('2026-08-21'), {
        positionKind: ShiftDayKind.WORK,
      }).working,
    ).toBe(true);
  });
});

describe('occupiesCalendarColumn', () => {
  const { CALENDAR_PARTICIPANT, WORK_EXECUTOR } = StaffPositionSettingKey;

  it('нужны обе настройки сразу', () => {
    expect(
      occupiesCalendarColumn(position([CALENDAR_PARTICIPANT, WORK_EXECUTOR])),
    ).toBe(true);
    expect(occupiesCalendarColumn(position([CALENDAR_PARTICIPANT]))).toBe(
      false,
    );
    expect(occupiesCalendarColumn(position([WORK_EXECUTOR]))).toBe(false);
  });

  it('без настроек колонки нет', () => {
    expect(occupiesCalendarColumn(position([]))).toBe(false);
  });
});
