import {
  currentWorkDayRange,
  resolveWorkDate,
  workDayRange,
} from './work-day.util';

const moscow = {
  timezone: 'Europe/Moscow',
  workDayStart: '10:00',
  workDayEnd: '21:00',
};

describe('resolveWorkDate', () => {
  it('днём — календарная дата в поясе тенанта', () => {
    expect(resolveWorkDate(new Date('2026-09-28T09:00:00Z'), moscow)).toBe(
      '2026-09-28',
    );
  });

  it('после полуночи до середины ночи — вчерашняя смена', () => {
    // 00:30 и 03:29 по Москве
    expect(resolveWorkDate(new Date('2026-09-27T21:30:00Z'), moscow)).toBe(
      '2026-09-27',
    );
    expect(resolveWorkDate(new Date('2026-09-28T00:29:59Z'), moscow)).toBe(
      '2026-09-27',
    );
  });

  it('с середины ночи — уже новый рабочий день', () => {
    // 03:30 по Москве
    expect(resolveWorkDate(new Date('2026-09-28T00:30:00Z'), moscow)).toBe(
      '2026-09-28',
    );
  });

  it('полночь UTC не влияет: считается пояс тенанта', () => {
    // 23:30 UTC = 02:30 следующего дня по Москве — ещё смена 28-го
    expect(resolveWorkDate(new Date('2026-09-28T23:30:00Z'), moscow)).toBe(
      '2026-09-28',
    );
  });

  it('ранняя смена: поздний вечер относится к завтра', () => {
    const early = { ...moscow, workDayStart: '06:00', workDayEnd: '15:00' };
    // 22:29 и 22:30 по Москве, граница — середина 15:00–06:00
    expect(resolveWorkDate(new Date('2026-09-28T19:29:00Z'), early)).toBe(
      '2026-09-28',
    );
    expect(resolveWorkDate(new Date('2026-09-28T19:30:00Z'), early)).toBe(
      '2026-09-29',
    );
  });

  it('ночная смена целиком — дата её начала', () => {
    const night = { ...moscow, workDayStart: '22:00', workDayEnd: '06:00' };
    // 23:00 28-го и 05:00 29-го по Москве; граница — 14:00
    expect(resolveWorkDate(new Date('2026-09-28T20:00:00Z'), night)).toBe(
      '2026-09-28',
    );
    expect(resolveWorkDate(new Date('2026-09-29T02:00:00Z'), night)).toBe(
      '2026-09-28',
    );
    expect(resolveWorkDate(new Date('2026-09-29T11:00:00Z'), night)).toBe(
      '2026-09-29',
    );
  });

  it('круглосуточный день без перерыва начинается в момент начала', () => {
    const allDay = { ...moscow, workDayStart: '00:00', workDayEnd: '00:00' };
    expect(resolveWorkDate(new Date('2026-09-27T21:00:00Z'), allDay)).toBe(
      '2026-09-28',
    );
    expect(resolveWorkDate(new Date('2026-09-27T20:59:59Z'), allDay)).toBe(
      '2026-09-27',
    );
  });
});

describe('workDayRange', () => {
  it('день 10:00–21:00 — с 03:30 до 03:30 следующих суток по Москве', () => {
    expect(workDayRange('2026-09-28', moscow)).toEqual({
      start: new Date('2026-09-28T00:30:00Z'),
      end: new Date('2026-09-29T00:30:00Z'),
    });
  });

  it('ранняя смена начинает сутки накануне вечером', () => {
    const early = { ...moscow, workDayStart: '06:00', workDayEnd: '15:00' };
    expect(workDayRange('2026-09-28', early).start).toEqual(
      new Date('2026-09-27T19:30:00Z'),
    );
  });

  it('момент всегда внутри границ своего рабочего дня', () => {
    for (const iso of [
      '2026-09-27T21:30:00Z',
      '2026-09-28T00:30:00Z',
      '2026-09-28T12:00:00Z',
      '2026-09-29T00:29:59Z',
    ]) {
      const at = new Date(iso);
      const { start, end } = currentWorkDayRange(moscow, at);
      expect(start.getTime()).toBeLessThanOrEqual(at.getTime());
      expect(end.getTime()).toBeGreaterThan(at.getTime());
    }
  });
});
