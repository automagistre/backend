import { mockDeep, type DeepMockProxy } from 'jest-mock-extended';
import { NotFoundException } from '@nestjs/common';
import { EmployeeSalaryService } from './employee-salary.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { SettingsService } from 'src/modules/settings/settings.service';
import { createPrismaMock } from 'src/common/testing/prisma-mock';
import { makeCtx } from 'src/common/testing/auth-context';

describe('EmployeeSalaryService', () => {
  let prisma: DeepMockProxy<PrismaService>;
  let settings: DeepMockProxy<SettingsService>;
  let service: EmployeeSalaryService;
  const ctx = makeCtx();

  beforeEach(() => {
    prisma = createPrismaMock();
    settings = mockDeep<SettingsService>();
    settings.getDefaultCurrencyCode.mockResolvedValue('RUB');
    service = new EmployeeSalaryService(
      prisma as unknown as PrismaService,
      settings as unknown as SettingsService,
    );
  });

  describe('listByEmployee', () => {
    it('маппит isCancelled из наличия employeeSalaryEnd', async () => {
      prisma.employeeSalary.findMany.mockResolvedValue([
        {
          id: 's1',
          employeeId: 'e1',
          payday: 5,
          amount: 100n,
          createdAt: new Date(),
          employeeSalaryEnd: { id: 'end1' },
        },
        {
          id: 's2',
          employeeId: 'e1',
          payday: 5,
          amount: 200n,
          createdAt: new Date(),
          employeeSalaryEnd: null,
        },
      ] as any);

      const res = await service.listByEmployee(ctx, 'e1');

      expect(res[0].isCancelled).toBe(true);
      expect(res[1].isCancelled).toBe(false);
    });
  });

  describe('create', () => {
    it('бросает NotFound при отсутствии сотрудника', async () => {
      prisma.employee.findFirst.mockResolvedValue(null);
      await expect(
        service.create(ctx, {
          employeeId: 'nope',
          payday: 5,
          amount: { amountMinor: 100n, currencyCode: 'RUB' },
        } as any),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('создаёт запись с нормализованной суммой и контекстом', async () => {
      prisma.employee.findFirst.mockResolvedValue({ id: 'e1' } as any);
      prisma.employeeSalary.create.mockResolvedValue({ id: 's1' } as any);

      await service.create(ctx, {
        employeeId: 'e1',
        payday: 10,
        amount: { amountMinor: 50000n },
      } as any);

      const arg = prisma.employeeSalary.create.mock.calls[0][0];
      expect(arg.data).toMatchObject({
        employeeId: 'e1',
        payday: 10,
        amount: 50000n,
        tenantId: ctx.tenantId,
        createdBy: ctx.userId,
      });
    });
  });

  describe('cancel', () => {
    it('бросает NotFound, если оклад не найден', async () => {
      prisma.employeeSalary.findFirst.mockResolvedValue(null);
      await expect(service.cancel(ctx, 's1')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('бросает, если уже отменён', async () => {
      prisma.employeeSalary.findFirst.mockResolvedValue({
        id: 's1',
        employeeSalaryEnd: { id: 'end1' },
      } as any);
      await expect(service.cancel(ctx, 's1')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('создаёт employeeSalaryEnd для активного оклада', async () => {
      prisma.employeeSalary.findFirst.mockResolvedValue({
        id: 's1',
        employeeSalaryEnd: null,
      } as any);
      prisma.employeeSalaryEnd.create.mockResolvedValue({ id: 'end1' } as any);

      await service.cancel(ctx, 's1');

      expect(prisma.employeeSalaryEnd.create).toHaveBeenCalledWith({
        data: { salaryId: 's1', tenantId: ctx.tenantId, createdBy: ctx.userId },
      });
    });
  });
});
