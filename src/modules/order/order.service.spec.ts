import { mockDeep, type DeepMockProxy } from 'jest-mock-extended';
import { OrderService } from './order.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { WalletTransactionService } from 'src/modules/wallet/wallet-transaction.service';
import { SalaryService } from 'src/modules/salary/salary.service';
import { CustomerTransactionService } from 'src/modules/customer-transaction/customer-transaction.service';
import { SettingsService } from 'src/modules/settings/settings.service';
import { WarehouseService } from 'src/modules/warehouse/warehouse.service';
import { OrganizationService } from 'src/modules/organization/organization.service';
import { TasksService } from 'src/modules/tasks/tasks.service';
import { RecommendationWorkMigrationService } from 'src/modules/recommendation-migration/recommendation-work-migration.service';
import { AuditLogService } from 'src/modules/audit-log/audit-log.service';
import { EmployeeService } from 'src/modules/employee/employee.service';
import { OrderStatus } from './enums/order-status.enum';
import { createPrismaMock, type PrismaMock } from 'src/common/testing/prisma-mock';
import { makeCtx } from 'src/common/testing/auth-context';

describe('OrderService.getCloseValidation', () => {
  let prisma: PrismaMock;
  let employeeService: DeepMockProxy<EmployeeService>;
  let service: OrderService;
  const ctx = makeCtx();

  beforeEach(() => {
    prisma = createPrismaMock();
    employeeService = mockDeep<EmployeeService>();
    service = new OrderService(
      prisma as unknown as PrismaService,
      mockDeep<WalletTransactionService>() as unknown as WalletTransactionService,
      mockDeep<SalaryService>() as unknown as SalaryService,
      mockDeep<CustomerTransactionService>() as unknown as CustomerTransactionService,
      mockDeep<SettingsService>() as unknown as SettingsService,
      mockDeep<WarehouseService>() as unknown as WarehouseService,
      mockDeep<OrganizationService>() as unknown as OrganizationService,
      mockDeep<TasksService>() as unknown as TasksService,
      mockDeep<RecommendationWorkMigrationService>() as unknown as RecommendationWorkMigrationService,
      mockDeep<AuditLogService>() as unknown as AuditLogService,
      employeeService as unknown as EmployeeService,
    );
  });

  const order = (over: Record<string, any> = {}) => ({
    status: OrderStatus.WORKING,
    carId: null,
    mileage: null,
    items: [],
    ...over,
  });

  it('заказ не найден → нельзя закрыть, без дефицитов', async () => {
    prisma.order.findFirst.mockResolvedValue(null);
    const res = await service.getCloseValidation(ctx, 'o1');
    expect(res).toEqual({ canClose: false, closeDeficiencies: [] });
  });

  it('закрытый/отменённый статус → нельзя закрыть, без дефицитов', async () => {
    prisma.order.findFirst.mockResolvedValue(
      order({ status: OrderStatus.CLOSED }) as any,
    );
    const res = await service.getCloseValidation(ctx, 'o1');
    expect(res).toEqual({ canClose: false, closeDeficiencies: [] });
  });

  it('есть авто, но не указан пробег → MILEAGE_MISSING', async () => {
    prisma.order.findFirst.mockResolvedValue(
      order({ carId: 'car-1', mileage: null }) as any,
    );
    const res = await service.getCloseValidation(ctx, 'o1');
    expect(res.closeDeficiencies).toContain('MILEAGE_MISSING');
    expect(res.canClose).toBe(false);
  });

  it('работа (type=1) без исполнителя, в т.ч. вложенная → SERVICES_WITHOUT_WORKER', async () => {
    prisma.order.findFirst.mockResolvedValue(
      order({
        items: [
          {
            type: '2',
            service: null,
            children: [
              { type: '1', service: { executorId: null }, children: [] },
            ],
          },
        ],
      }) as any,
    );
    const res = await service.getCloseValidation(ctx, 'o1');
    expect(res.closeDeficiencies).toContain('SERVICES_WITHOUT_WORKER');
  });

  it('подрядная работа без себестоимости → CONTRACTOR_WITHOUT_COST', async () => {
    prisma.order.findFirst.mockResolvedValue(
      order({
        items: [
          {
            type: '1',
            service: {
              executorId: 'org-1',
              kind: 'CONTRACTOR',
              costAmount: null,
            },
            children: [],
          },
        ],
      }) as any,
    );
    const res = await service.getCloseValidation(ctx, 'o1');
    expect(res.closeDeficiencies).toContain('CONTRACTOR_WITHOUT_COST');
    expect(res.canClose).toBe(false);
  });

  it('подрядная работа с себестоимостью → можно закрыть', async () => {
    prisma.order.findFirst.mockResolvedValue(
      order({
        items: [
          {
            type: '1',
            service: {
              executorId: 'org-1',
              kind: 'CONTRACTOR',
              costAmount: 500000n,
            },
            children: [],
          },
        ],
      }) as any,
    );
    const res = await service.getCloseValidation(ctx, 'o1');
    expect(res).toEqual({ canClose: true, closeDeficiencies: [] });
  });

  it('все работы с исполнителем и есть пробег → можно закрыть', async () => {
    prisma.order.findFirst.mockResolvedValue(
      order({
        carId: 'car-1',
        mileage: 1000,
        items: [
          { type: '1', service: { executorId: 'person-1' }, children: [] },
        ],
      }) as any,
    );
    const res = await service.getCloseValidation(ctx, 'o1');
    expect(res).toEqual({ canClose: true, closeDeficiencies: [] });
  });

  it('гарантийная работа без warrantyPayer → WARRANTY_WITHOUT_PAYER', async () => {
    prisma.order.findFirst.mockResolvedValue(
      order({
        items: [
          {
            type: '1',
            service: {
              executorId: 'person-1',
              executorKind: 'PERSON',
              warranty: true,
              warrantyPayer: null,
            },
            children: [],
          },
        ],
      }) as any,
    );
    const res = await service.getCloseValidation(ctx, 'o1');
    expect(res.closeDeficiencies).toContain('WARRANTY_WITHOUT_PAYER');
    expect(res.canClose).toBe(false);
  });

  it('гарантийная запчасть без warrantyPayer → WARRANTY_WITHOUT_PAYER', async () => {
    prisma.order.findFirst.mockResolvedValue(
      order({
        items: [
          {
            type: '2',
            part: { warranty: true, warrantyPayer: null },
            children: [],
          },
        ],
      }) as any,
    );
    const res = await service.getCloseValidation(ctx, 'o1');
    expect(res.closeDeficiencies).toContain('WARRANTY_WITHOUT_PAYER');
  });

  it('заказ 69137: корневая запчасть EXECUTOR + подрядная работа в группе → без дефицита', async () => {
    prisma.order.findFirst.mockResolvedValue(
      order({
        assigneeId: null,
        items: [
          {
            type: '2',
            part: { warranty: false, warrantyPayer: null },
            children: [],
          },
          {
            type: '2',
            part: { warranty: true, warrantyPayer: 'EXECUTOR' },
            children: [],
          },
          {
            type: '3',
            children: [
              {
                type: '1',
                service: {
                  kind: 'CONTRACTOR',
                  executorId: 'org-1',
                  executorKind: 'ORGANIZATION',
                  costAmount: 300000n,
                  warranty: false,
                  warrantyPayer: 'ORGANIZATION',
                },
                children: [],
              },
            ],
          },
        ],
      }) as any,
    );
    const res = await service.getCloseValidation(ctx, 'o1');
    expect(res.closeDeficiencies).not.toContain('WARRANTY_EXECUTOR_REQUIRED');
    expect(res.canClose).toBe(true);
  });

  it('гарантия EXECUTOR за AUTOSERVICE с исполнителем-организацией → без дефицита', async () => {
    prisma.order.findFirst.mockResolvedValue(
      order({
        items: [
          {
            type: '1',
            service: {
              kind: 'AUTOSERVICE',
              executorId: 'org-1',
              executorKind: 'ORGANIZATION',
              warranty: true,
              warrantyPayer: 'EXECUTOR',
            },
            children: [],
          },
        ],
      }) as any,
    );
    const res = await service.getCloseValidation(ctx, 'o1');
    expect(res.closeDeficiencies).not.toContain('WARRANTY_EXECUTOR_REQUIRED');
    expect(res.canClose).toBe(true);
  });

  it('гарантия подрядной работы с подрядчиком → без WARRANTY_EXECUTOR_REQUIRED', async () => {
    prisma.order.findFirst.mockResolvedValue(
      order({
        items: [
          {
            type: '1',
            service: {
              kind: 'CONTRACTOR',
              executorId: 'org-1',
              executorKind: 'ORGANIZATION',
              costAmount: 50000n,
              warranty: true,
              warrantyPayer: 'EXECUTOR',
            },
            children: [],
          },
        ],
      }) as any,
    );
    const res = await service.getCloseValidation(ctx, 'o1');
    expect(res.closeDeficiencies).not.toContain('WARRANTY_EXECUTOR_REQUIRED');
    expect(res.canClose).toBe(true);
  });

  it('гарантия EXECUTOR за запчасть под подрядной работой без ответственного → без дефицита', async () => {
    prisma.order.findFirst.mockResolvedValue(
      order({
        assigneeId: null,
        items: [
          {
            type: '1',
            service: {
              kind: 'CONTRACTOR',
              executorId: 'org-1',
              executorKind: 'ORGANIZATION',
              costAmount: 50000n,
              warranty: true,
              warrantyPayer: 'ORGANIZATION',
            },
            children: [
              {
                type: '2',
                part: { warranty: true, warrantyPayer: 'EXECUTOR' },
                children: [],
              },
            ],
          },
        ],
      }) as any,
    );
    const res = await service.getCloseValidation(ctx, 'o1');
    expect(res.closeDeficiencies).not.toContain('WARRANTY_EXECUTOR_REQUIRED');
    expect(res.canClose).toBe(true);
  });

  it('гарантия EXECUTOR за работу: сотрудник без ratio → WARRANTY_EXECUTOR_REQUIRED', async () => {
    prisma.order.findFirst.mockResolvedValue(
      order({
        items: [
          {
            type: '1',
            service: {
              executorId: 'person-1',
              executorKind: 'PERSON',
              warranty: true,
              warrantyPayer: 'EXECUTOR',
            },
            children: [],
          },
        ],
      }) as any,
    );
    employeeService.findByPersonId.mockResolvedValue({
      id: 'emp-1',
      personId: 'person-1',
      ratio: null,
      firedAt: null,
    } as any);
    const res = await service.getCloseValidation(ctx, 'o1');
    expect(res.closeDeficiencies).toContain('WARRANTY_EXECUTOR_REQUIRED');
  });

  it('гарантия EXECUTOR за работу: исполнитель-сотрудник со ставкой → без дефицита', async () => {
    prisma.order.findFirst.mockResolvedValue(
      order({
        items: [
          {
            type: '1',
            service: {
              executorId: 'person-1',
              executorKind: 'PERSON',
              warranty: true,
              warrantyPayer: 'EXECUTOR',
            },
            children: [],
          },
        ],
      }) as any,
    );
    employeeService.findByPersonId.mockResolvedValue({
      id: 'emp-1',
      personId: 'person-1',
      ratio: 40,
      firedAt: null,
    } as any);
    const res = await service.getCloseValidation(ctx, 'o1');
    expect(res).toEqual({ canClose: true, closeDeficiencies: [] });
  });

  it('гарантия EXECUTOR за запчасть: родительская работа за сотрудником → без дефицита', async () => {
    prisma.order.findFirst.mockResolvedValue(
      order({
        items: [
          {
            type: '1',
            service: {
              executorId: 'person-1',
              executorKind: 'PERSON',
              warranty: false,
              warrantyPayer: null,
            },
            children: [
              {
                type: '2',
                part: { warranty: true, warrantyPayer: 'EXECUTOR' },
                children: [],
              },
            ],
          },
        ],
      }) as any,
    );
    const res = await service.getCloseValidation(ctx, 'o1');
    expect(res).toEqual({ canClose: true, closeDeficiencies: [] });
  });

  it('гарантия EXECUTOR за корневую запчасть без ответственного → платит организация, без дефицита', async () => {
    prisma.order.findFirst.mockResolvedValue(
      order({
        assigneeId: null,
        items: [
          {
            type: '2',
            part: { warranty: true, warrantyPayer: 'EXECUTOR' },
            children: [],
          },
        ],
      }) as any,
    );
    const res = await service.getCloseValidation(ctx, 'o1');
    expect(res.closeDeficiencies).not.toContain('WARRANTY_EXECUTOR_REQUIRED');
    expect(res.canClose).toBe(true);
  });

  it('гарантия EXECUTOR за запчасть без родителя-сотрудника, но с ответственным по заказу → без дефицита', async () => {
    prisma.order.findFirst.mockResolvedValue(
      order({
        assigneeId: 'assignee-1',
        items: [
          {
            type: '2',
            part: { warranty: true, warrantyPayer: 'EXECUTOR' },
            children: [],
          },
        ],
      }) as any,
    );
    const res = await service.getCloseValidation(ctx, 'o1');
    expect(res).toEqual({ canClose: true, closeDeficiencies: [] });
  });

  it('гарантия ORGANIZATION за работу и запчасть → без дефицита', async () => {
    prisma.order.findFirst.mockResolvedValue(
      order({
        items: [
          {
            type: '1',
            service: {
              executorId: 'person-1',
              executorKind: 'PERSON',
              warranty: true,
              warrantyPayer: 'ORGANIZATION',
            },
            children: [
              {
                type: '2',
                part: { warranty: true, warrantyPayer: 'ORGANIZATION' },
                children: [],
              },
            ],
          },
        ],
      }) as any,
    );
    const res = await service.getCloseValidation(ctx, 'o1');
    expect(res).toEqual({ canClose: true, closeDeficiencies: [] });
  });
});
