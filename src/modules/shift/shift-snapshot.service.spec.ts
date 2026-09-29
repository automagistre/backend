import { mockDeep, type DeepMockProxy } from 'jest-mock-extended';
import type { Prisma } from 'src/generated/prisma/client';
import { createPrismaMock } from 'src/common/testing/prisma-mock';
import { PrismaService } from 'src/prisma/prisma.service';
import { SettingsService } from 'src/modules/settings/settings.service';
import { parseDateKey } from './shift.rules';
import { ShiftService } from './shift.service';
import {
  shiftMembersHash,
  ShiftSnapshotService,
} from './shift-snapshot.service';

describe('shiftMembersHash', () => {
  it('не зависит от порядка и повторов', () => {
    const a = { employeeId: 'e1', positionId: 'p1' };
    const b = { employeeId: 'e2', positionId: 'p2' };
    expect(shiftMembersHash([a, b])).toBe(shiftMembersHash([b, a, b]));
  });

  it('совместитель в двух ролях — другой состав, чем в одной', () => {
    const single = [{ employeeId: 'e1', positionId: 'p1' }];
    const dual = [...single, { employeeId: 'e1', positionId: 'p2' }];
    expect(shiftMembersHash(single)).not.toBe(shiftMembersHash(dual));
  });

  it('пустой состав тоже даёт хэш', () => {
    expect(shiftMembersHash([])).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('ShiftSnapshotService.capture', () => {
  let tx: DeepMockProxy<Prisma.TransactionClient>;
  let shifts: DeepMockProxy<ShiftService>;
  let settings: DeepMockProxy<SettingsService>;
  let service: ShiftSnapshotService;

  const pairs = [
    { employeeId: 'e1', positionId: 'p1' },
    { employeeId: 'e2', positionId: 'p2' },
  ];
  // 02:00 по Москве — ещё смена 27-го
  const at = new Date('2026-09-27T23:00:00Z');
  const workDate = parseDateKey('2026-09-27');
  const where = {
    tenantId_workDate_membersHash: {
      tenantId: 'tenant-1',
      workDate,
      membersHash: shiftMembersHash(pairs),
    },
  };

  beforeEach(() => {
    tx = mockDeep<Prisma.TransactionClient>();
    shifts = mockDeep<ShiftService>();
    settings = mockDeep<SettingsService>();
    settings.getWorkDayHours.mockResolvedValue({
      timezone: 'Europe/Moscow',
      workDayStart: '10:00',
      workDayEnd: '21:00',
    });
    shifts.findWorkingPairs.mockResolvedValue(pairs);
    service = new ShiftSnapshotService(
      mockDeep<PrismaService>(),
      shifts,
      settings,
    );
  });

  it('без транзакции снимок и пары пишутся в одной транзакции', async () => {
    const prisma = createPrismaMock();
    prisma.shiftSnapshot.findUnique.mockResolvedValue(null);
    prisma.shiftSnapshot.createMany.mockResolvedValue({ count: 1 });

    await service.capture(prisma, 'tenant-1', at);

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.shiftSnapshotMember.createMany).toHaveBeenCalled();
  });

  it('берёт состав рабочего дня, а не календарного', async () => {
    tx.shiftSnapshot.findUnique.mockResolvedValue({ id: 'snap-1' } as any);

    await service.capture(tx, 'tenant-1', at);

    expect(shifts.findWorkingPairs).toHaveBeenCalledWith(
      'tenant-1',
      '2026-09-27',
    );
  });

  it('тот же состав за день — существующий снимок без записи', async () => {
    tx.shiftSnapshot.findUnique.mockResolvedValue({ id: 'snap-1' } as any);

    await expect(service.capture(tx, 'tenant-1', at)).resolves.toBe('snap-1');
    expect(tx.shiftSnapshot.findUnique).toHaveBeenCalledWith({
      where,
      select: { id: true },
    });
    expect(tx.shiftSnapshot.createMany).not.toHaveBeenCalled();
  });

  it('новый состав — снимок и его пары', async () => {
    tx.shiftSnapshot.findUnique.mockResolvedValue(null);
    tx.shiftSnapshot.createMany.mockResolvedValue({ count: 1 });

    const id = await service.capture(tx, 'tenant-1', at);

    expect(tx.shiftSnapshot.createMany).toHaveBeenCalledWith({
      data: [
        {
          id,
          tenantId: 'tenant-1',
          workDate,
          membersHash: shiftMembersHash(pairs),
          takenAt: at,
        },
      ],
      skipDuplicates: true,
    });
    expect(tx.shiftSnapshotMember.createMany).toHaveBeenCalledWith({
      data: pairs.map((pair) => ({ snapshotId: id, ...pair })),
      skipDuplicates: true,
    });
  });

  it('пустая смена — снимок без пар', async () => {
    shifts.findWorkingPairs.mockResolvedValue([]);
    tx.shiftSnapshot.findUnique.mockResolvedValue(null);
    tx.shiftSnapshot.createMany.mockResolvedValue({ count: 1 });

    const id = await service.capture(tx, 'tenant-1', at);

    expect(id).toEqual(expect.any(String));
    expect(tx.shiftSnapshotMember.createMany).not.toHaveBeenCalled();
  });

  it('параллельная продажа успела первой — берём её снимок', async () => {
    tx.shiftSnapshot.findUnique.mockResolvedValue(null);
    tx.shiftSnapshot.createMany.mockResolvedValue({ count: 0 });
    tx.shiftSnapshot.findUniqueOrThrow.mockResolvedValue({
      id: 'snap-concurrent',
    } as any);

    await expect(service.capture(tx, 'tenant-1', at)).resolves.toBe(
      'snap-concurrent',
    );
    expect(tx.shiftSnapshotMember.createMany).not.toHaveBeenCalled();
  });
});
