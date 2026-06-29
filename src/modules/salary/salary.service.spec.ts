import { mockDeep, type DeepMockProxy } from 'jest-mock-extended';
import { SalaryService } from './salary.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { EmployeeService } from 'src/modules/employee/employee.service';
import { CustomerTransactionService } from 'src/modules/customer-transaction/customer-transaction.service';
import { SettingsService } from 'src/modules/settings/settings.service';
import { AuditLogService } from 'src/modules/audit-log/audit-log.service';
import { DisplayContextService } from 'src/modules/display-context/display-context.service';
import { CustomerTransactionSource } from 'src/modules/customer-transaction/enums/customer-transaction-source.enum';
import type { AuthContext } from 'src/common/user-id.store';
import { createPrismaMock } from 'src/common/testing/prisma-mock';
import { makeCtx } from 'src/common/testing/auth-context';

/**
 * Фаза 1: chargeByOrder начисляет ЗП по executor (kind=PERSON), организациям — нет.
 */
describe('SalaryService.chargeByOrder', () => {
  let prisma: DeepMockProxy<PrismaService>;
  let employee: DeepMockProxy<EmployeeService>;
  let customerTx: DeepMockProxy<CustomerTransactionService>;
  let settings: DeepMockProxy<SettingsService>;
  let audit: DeepMockProxy<AuditLogService>;
  let display: DeepMockProxy<DisplayContextService>;
  let service: SalaryService;

  const ctx: AuthContext = {
    userId: 'user-1',
    tenantId: 'tenant-1',
    tenantGroupId: 'group-1',
  };

  beforeEach(() => {
    prisma = mockDeep<PrismaService>();
    employee = mockDeep<EmployeeService>();
    customerTx = mockDeep<CustomerTransactionService>();
    settings = mockDeep<SettingsService>();
    audit = mockDeep<AuditLogService>();
    display = mockDeep<DisplayContextService>();

    settings.getDefaultCurrencyCode.mockResolvedValue('RUB');
    display.getPersonDisplay.mockResolvedValue('Иванов Иван');
    prisma.$transaction.mockImplementation(async (cb: any) => cb(prisma));

    service = new SalaryService(
      prisma as unknown as PrismaService,
      employee as unknown as EmployeeService,
      customerTx as unknown as CustomerTransactionService,
      settings as unknown as SettingsService,
      audit as unknown as AuditLogService,
      display as unknown as DisplayContextService,
    );
  });

  const svc = (over: Record<string, any> = {}) => ({
    service: {
      executorKind: 'PERSON',
      executorId: 'person-1',
      warranty: false,
      priceAmount: 10000n,
      discountAmount: 0n,
      ...over,
    },
  });

  it('идемпотентность: при существующей проводке OrderSalary ничего не делает', async () => {
    prisma.customerTransaction.findFirst.mockResolvedValue({ id: 'tx' } as any);

    await service.chargeByOrder(ctx, 'order-1');

    expect(prisma.orderItem.findMany).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('начисляет по ratio: operandId = employee.personId, сумма = total*ratio/100', async () => {
    prisma.customerTransaction.findFirst.mockResolvedValue(null);
    prisma.orderItem.findMany.mockResolvedValue([svc()] as any);
    employee.findByPersonId.mockResolvedValue({
      id: 'emp-1',
      personId: 'person-1',
      ratio: 50,
      firedAt: null,
    } as any);

    await service.chargeByOrder(ctx, 'order-1');

    expect(employee.findByPersonId).toHaveBeenCalledWith(ctx, 'person-1');
    expect(customerTx.createWithinTransaction).toHaveBeenCalledTimes(1);
    const arg = customerTx.createWithinTransaction.mock.calls[0][1];
    expect(arg.operandId).toBe('person-1');
    expect(arg.source).toBe(CustomerTransactionSource.OrderSalary);
    expect(arg.amount?.amountMinor).toBe(5000n);
    expect(audit.record).toHaveBeenCalledTimes(1);
  });

  it('пропускает исполнителя-организацию (ЗП только персонам)', async () => {
    prisma.customerTransaction.findFirst.mockResolvedValue(null);
    prisma.orderItem.findMany.mockResolvedValue([
      svc({ executorKind: 'ORGANIZATION', executorId: 'org-1' }),
    ] as any);

    await service.chargeByOrder(ctx, 'order-1');

    expect(employee.findByPersonId).not.toHaveBeenCalled();
    expect(customerTx.createWithinTransaction).not.toHaveBeenCalled();
  });

  it('пропускает гарантийные работы', async () => {
    prisma.customerTransaction.findFirst.mockResolvedValue(null);
    prisma.orderItem.findMany.mockResolvedValue([svc({ warranty: true })] as any);

    await service.chargeByOrder(ctx, 'order-1');

    expect(customerTx.createWithinTransaction).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('пропускает работы без исполнителя (executor = null)', async () => {
    prisma.customerTransaction.findFirst.mockResolvedValue(null);
    prisma.orderItem.findMany.mockResolvedValue([
      svc({ executorKind: null, executorId: null }),
    ] as any);

    await service.chargeByOrder(ctx, 'order-1');

    expect(employee.findByPersonId).not.toHaveBeenCalled();
    expect(customerTx.createWithinTransaction).not.toHaveBeenCalled();
  });

  it('пропускает уволенного / без ratio', async () => {
    prisma.customerTransaction.findFirst.mockResolvedValue(null);
    prisma.orderItem.findMany.mockResolvedValue([svc()] as any);
    employee.findByPersonId.mockResolvedValue({
      id: 'emp-1',
      personId: 'person-1',
      ratio: null,
      firedAt: null,
    } as any);

    await service.chargeByOrder(ctx, 'order-1');

    expect(customerTx.createWithinTransaction).not.toHaveBeenCalled();
  });
});

describe('SalaryService.chargeMonthlySalaries', () => {
  let prisma: DeepMockProxy<PrismaService>;
  let employee: DeepMockProxy<EmployeeService>;
  let customerTx: DeepMockProxy<CustomerTransactionService>;
  let settings: DeepMockProxy<SettingsService>;
  let audit: DeepMockProxy<AuditLogService>;
  let display: DeepMockProxy<DisplayContextService>;
  let service: SalaryService;

  const ctx = makeCtx();

  beforeEach(() => {
    prisma = createPrismaMock();
    employee = mockDeep<EmployeeService>();
    customerTx = mockDeep<CustomerTransactionService>();
    settings = mockDeep<SettingsService>();
    audit = mockDeep<AuditLogService>();
    display = mockDeep<DisplayContextService>();

    settings.getDefaultCurrencyCode.mockResolvedValue('RUB');

    service = new SalaryService(
      prisma as unknown as PrismaService,
      employee as unknown as EmployeeService,
      customerTx as unknown as CustomerTransactionService,
      settings as unknown as SettingsService,
      audit as unknown as AuditLogService,
      display as unknown as DisplayContextService,
    );
    jest.spyOn((service as any).logger, 'log').mockImplementation(() => {});
    jest.spyOn((service as any).logger, 'error').mockImplementation(() => {});
  });

  const salary = (over: Record<string, any> = {}) => ({
    id: 'salary-1',
    employeeId: 'emp-1',
    amount: 100000n,
    employee: { personId: 'person-1' },
    ...over,
  });

  it('начисляет: operandId = employee.personId, source=MonthlySalary, sourceId=salary.id', async () => {
    prisma.employeeSalary.findMany.mockResolvedValue([salary()] as any);
    prisma.customerTransaction.findFirst.mockResolvedValue(null);

    await service.chargeMonthlySalaries(ctx, 5);

    expect(customerTx.createWithinTransaction).toHaveBeenCalledTimes(1);
    const arg = customerTx.createWithinTransaction.mock.calls[0][1];
    expect(arg.operandId).toBe('person-1');
    expect(arg.source).toBe(CustomerTransactionSource.MonthlySalary);
    expect(arg.sourceId).toBe('salary-1');
    expect(arg.amount?.amountMinor).toBe(100000n);
  });

  it('идемпотентность в текущем месяце: при существующей проводке пропускает', async () => {
    prisma.employeeSalary.findMany.mockResolvedValue([salary()] as any);
    prisma.customerTransaction.findFirst.mockResolvedValue({ id: 'tx' } as any);

    await service.chargeMonthlySalaries(ctx, 5);

    expect(customerTx.createWithinTransaction).not.toHaveBeenCalled();
  });

  it('пропускает нулевой оклад', async () => {
    prisma.employeeSalary.findMany.mockResolvedValue([
      salary({ amount: 0n }),
    ] as any);
    prisma.customerTransaction.findFirst.mockResolvedValue(null);

    await service.chargeMonthlySalaries(ctx, 5);

    expect(customerTx.createWithinTransaction).not.toHaveBeenCalled();
  });

  it('ошибка по одному окладу не прерывает остальные', async () => {
    prisma.employeeSalary.findMany.mockResolvedValue([
      salary({ id: 'salary-1', employee: { personId: 'p1' } }),
      salary({ id: 'salary-2', employee: { personId: 'p2' } }),
    ] as any);
    prisma.customerTransaction.findFirst.mockResolvedValue(null);
    customerTx.createWithinTransaction
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce({} as any);

    await expect(service.chargeMonthlySalaries(ctx, 5)).resolves.toBeUndefined();
    expect(customerTx.createWithinTransaction).toHaveBeenCalledTimes(2);
  });
});
