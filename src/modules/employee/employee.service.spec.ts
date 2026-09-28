import { BadRequestException } from '@nestjs/common';
import { mockDeep, type DeepMockProxy } from 'jest-mock-extended';
import { EmployeeService } from './employee.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { SettingsService } from 'src/modules/settings/settings.service';
import type { AuthContext } from 'src/common/user-id.store';

/**
 * После унификации workerId «исчез»: остаются только однозначные конвертеры
 * person <-> employee. Спек фиксирует их поведение.
 */
describe('EmployeeService person/employee converters', () => {
  let prisma: DeepMockProxy<PrismaService>;
  let settings: DeepMockProxy<SettingsService>;
  let service: EmployeeService;

  const ctx: AuthContext = {
    userId: 'u',
    tenantId: 'tenant-1',
    tenantGroupId: 'group-1',
  };

  const emp = {
    id: 'emp-1',
    personId: 'person-1',
    ratio: 50,
    firedAt: null,
    staffPositions: [],
  };

  beforeEach(() => {
    prisma = mockDeep<PrismaService>();
    settings = mockDeep<SettingsService>();
    settings.getDefaultCurrencyCode.mockResolvedValue('RUB');
    service = new EmployeeService(prisma, settings);
  });

  it('findByPersonId ищет по personId в рамках тенанта', async () => {
    jest.mocked(prisma.employee.findFirst).mockResolvedValue(emp as any);
    const res = await service.findByPersonId(ctx, 'person-1');
    expect(res?.id).toBe('emp-1');
    expect(prisma.employee.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ personId: 'person-1' }),
        orderBy: { firedAt: { sort: 'asc', nulls: 'first' } },
      }),
    );
  });

  it('resolvePersonIdByEmployeeId: employee.id -> personId', async () => {
    jest.mocked(prisma.employee.findFirst).mockResolvedValue(emp as any);
    expect(await service.resolvePersonIdByEmployeeId(ctx, 'emp-1')).toBe(
      'person-1',
    );
    expect(await service.resolvePersonIdByEmployeeId(ctx, null)).toBeNull();
  });

  it('resolveEmployeeIdByPersonId: personId -> employee.id', async () => {
    jest.mocked(prisma.employee.findFirst).mockResolvedValue(emp as any);
    expect(await service.resolveEmployeeIdByPersonId(ctx, 'person-1')).toBe(
      'emp-1',
    );
    expect(await service.resolveEmployeeIdByPersonId(ctx, null)).toBeNull();
  });
});

describe('EmployeeService positionIds', () => {
  let prisma: DeepMockProxy<PrismaService>;
  let settings: DeepMockProxy<SettingsService>;
  let service: EmployeeService;
  const ctx: AuthContext = {
    userId: 'u',
    tenantId: 'tenant-1',
    tenantGroupId: 'group-1',
  };

  beforeEach(() => {
    prisma = mockDeep<PrismaService>();
    settings = mockDeep<SettingsService>();
    settings.getDefaultCurrencyCode.mockResolvedValue('RUB');
    service = new EmployeeService(prisma, settings);
    jest
      .mocked(prisma.$transaction)
      .mockImplementation((fn: any) => fn(prisma));
  });

  it('при обновлении оставляет уже назначенную архивную должность', async () => {
    jest.mocked(prisma.employee.findFirst).mockResolvedValue({
      id: 'emp-1',
      tenantId: 'tenant-1',
    } as any);
    jest
      .mocked(prisma.employeeStaffPosition.findMany)
      .mockResolvedValue([{ positionId: 'pos-archived' }] as any);
    jest.mocked(prisma.staffPosition.count).mockResolvedValue(1);
    jest.mocked(prisma.employee.update).mockResolvedValue({
      id: 'emp-1',
      personId: 'person-1',
      staffPositions: [
        {
          position: {
            id: 'pos-archived',
            name: 'Механик',
            sortOrder: 10,
            archivedAt: new Date(),
            tenantId: 'tenant-1',
            createdAt: null,
            createdBy: null,
            settings: [],
          },
        },
      ],
    } as any);

    await service.update(ctx, {
      id: 'emp-1',
      positionIds: ['pos-archived'],
    });

    expect(prisma.staffPosition.count).toHaveBeenCalledWith({
      where: { id: { in: ['pos-archived'] }, tenantId: 'tenant-1' },
    });
    expect(prisma.employeeStaffPosition.deleteMany).not.toHaveBeenCalled();
    expect(prisma.employeeStaffPosition.createMany).not.toHaveBeenCalled();
  });

  it('при смене должностей удаляет только снятые и создаёт только новые', async () => {
    jest.mocked(prisma.employee.findFirst).mockResolvedValue({
      id: 'emp-1',
      tenantId: 'tenant-1',
    } as any);
    jest
      .mocked(prisma.employeeStaffPosition.findMany)
      .mockResolvedValue([
        { positionId: 'pos-keep' },
        { positionId: 'pos-drop' },
      ] as any);
    jest.mocked(prisma.staffPosition.count).mockResolvedValue(1);
    jest
      .mocked(prisma.employee.update)
      .mockResolvedValue({ id: 'emp-1', staffPositions: [] } as any);

    await service.update(ctx, {
      id: 'emp-1',
      positionIds: ['pos-keep', 'pos-new'],
    });

    expect(prisma.employeeStaffPosition.deleteMany).toHaveBeenCalledWith({
      where: { employeeId: 'emp-1', positionId: { in: ['pos-drop'] } },
    });
    expect(prisma.employeeStaffPosition.createMany).toHaveBeenCalledWith({
      data: [{ employeeId: 'emp-1', positionId: 'pos-new' }],
    });
    expect(prisma.employeeStaffPosition.updateMany).not.toHaveBeenCalled();
  });

  it('цикл пишется в основную должность', async () => {
    jest.mocked(prisma.employee.findFirst).mockResolvedValue({
      id: 'emp-1',
      tenantId: 'tenant-1',
    } as any);
    jest
      .mocked(prisma.employeeStaffPosition.findMany)
      .mockResolvedValue([
        { positionId: 'pos-parts' },
        { positionId: 'pos-master' },
      ] as any);
    jest.mocked(prisma.staffPosition.findMany).mockResolvedValue([
      { id: 'pos-parts', sortOrder: 20 },
      { id: 'pos-master', sortOrder: 10 },
    ] as any);
    jest
      .mocked(prisma.employee.update)
      .mockResolvedValue({ id: 'emp-1', staffPositions: [] } as any);

    await service.update(ctx, {
      id: 'emp-1',
      shift: { mask: '1100', startsOn: '2026-09-01' },
    });

    expect(prisma.employeeStaffPosition.updateMany).not.toHaveBeenCalled();
    expect(prisma.employeeStaffPosition.update).toHaveBeenCalledTimes(1);
    expect(prisma.employeeStaffPosition.update).toHaveBeenCalledWith({
      where: {
        employeeId_positionId: {
          employeeId: 'emp-1',
          positionId: 'pos-master',
        },
      },
      data: {
        shiftMask: '1100',
        shiftStartsOn: new Date('2026-09-01T00:00:00.000Z'),
      },
    });
  });

  it('positions: цикл меняется только у переданных должностей', async () => {
    jest.mocked(prisma.employee.findFirst).mockResolvedValue({
      id: 'emp-1',
      tenantId: 'tenant-1',
    } as any);
    jest
      .mocked(prisma.employeeStaffPosition.findMany)
      .mockResolvedValue([
        { positionId: 'pos-master' },
        { positionId: 'pos-keep' },
        { positionId: 'pos-drop' },
      ] as any);
    jest
      .mocked(prisma.staffPosition.count)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(2);
    jest
      .mocked(prisma.employee.update)
      .mockResolvedValue({ id: 'emp-1', staffPositions: [] } as any);

    await service.update(ctx, {
      id: 'emp-1',
      positions: [
        { positionId: 'pos-master', shift: null },
        { positionId: 'pos-keep' },
        {
          positionId: 'pos-parts',
          shift: { mask: '1100', startsOn: '2026-09-01' },
        },
      ],
    });

    expect(prisma.employeeStaffPosition.deleteMany).toHaveBeenCalledWith({
      where: { employeeId: 'emp-1', positionId: { in: ['pos-drop'] } },
    });
    expect(prisma.employeeStaffPosition.createMany).toHaveBeenCalledWith({
      data: [
        {
          employeeId: 'emp-1',
          positionId: 'pos-parts',
          shiftMask: '1100',
          shiftStartsOn: new Date('2026-09-01T00:00:00.000Z'),
        },
      ],
    });
    expect(prisma.employeeStaffPosition.update).toHaveBeenCalledTimes(1);
    expect(prisma.employeeStaffPosition.update).toHaveBeenCalledWith({
      where: {
        employeeId_positionId: {
          employeeId: 'emp-1',
          positionId: 'pos-master',
        },
      },
      data: { shiftMask: null, shiftStartsOn: null },
    });
  });

  it('positions нельзя смешивать со старыми positionIds и shift', async () => {
    jest.mocked(prisma.employee.findFirst).mockResolvedValue({
      id: 'emp-1',
      tenantId: 'tenant-1',
    } as any);
    jest.mocked(prisma.employeeStaffPosition.findMany).mockResolvedValue([]);

    await expect(
      service.update(ctx, {
        id: 'emp-1',
        positions: [{ positionId: 'pos-master' }],
        positionIds: ['pos-master'],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('цикл без должности задать нельзя', async () => {
    jest.mocked(prisma.employee.findFirst).mockResolvedValue({
      id: 'emp-1',
      tenantId: 'tenant-1',
    } as any);
    jest.mocked(prisma.employeeStaffPosition.findMany).mockResolvedValue([]);

    await expect(
      service.update(ctx, {
        id: 'emp-1',
        shift: { mask: '1100', startsOn: '2026-09-01' },
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('новую архивную должность назначить нельзя', async () => {
    jest.mocked(prisma.employee.findFirst).mockResolvedValue({
      id: 'emp-1',
      tenantId: 'tenant-1',
    } as any);
    jest.mocked(prisma.employeeStaffPosition.findMany).mockResolvedValue([]);
    jest.mocked(prisma.staffPosition.count).mockResolvedValue(0);

    await expect(
      service.update(ctx, { id: 'emp-1', positionIds: ['pos-archived'] }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
