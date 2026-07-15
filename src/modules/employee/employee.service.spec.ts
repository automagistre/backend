import { mockDeep, type DeepMockProxy } from 'jest-mock-extended';
import { EmployeeService } from './employee.service';
import { PrismaService } from 'src/prisma/prisma.service';
import type { AuthContext } from 'src/common/user-id.store';

/**
 * После унификации workerId «исчез»: остаются только однозначные конвертеры
 * person <-> employee. Спек фиксирует их поведение.
 */
describe('EmployeeService person/employee converters', () => {
  let prisma: DeepMockProxy<PrismaService>;
  let service: EmployeeService;

  const ctx: AuthContext = {
    userId: 'u',
    tenantId: 'tenant-1',
    tenantGroupId: 'group-1',
  };

  const emp = { id: 'emp-1', personId: 'person-1', ratio: 50, firedAt: null };

  beforeEach(() => {
    prisma = mockDeep<PrismaService>();
    service = new EmployeeService(prisma as unknown as PrismaService);
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
