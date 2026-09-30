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
import { ProfitService } from 'src/modules/profit/profit.service';
import { TireStorageService } from 'src/modules/tire-storage/tire-storage.service';
import { CalendarService } from 'src/modules/calendar/calendar.service';
import { MotivationAccrualService } from 'src/modules/motivation/accrual/motivation-accrual.service';
import { OrderStatus } from './enums/order-status.enum';
import { CustomerTransactionSource } from 'src/modules/customer-transaction/enums/customer-transaction-source.enum';
import {
  createPrismaMock,
  type PrismaMock,
} from 'src/common/testing/prisma-mock';
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
      mockDeep<ProfitService>() as unknown as ProfitService,
      mockDeep<TireStorageService>() as unknown as TireStorageService,
      mockDeep<CalendarService>() as unknown as CalendarService,
      mockDeep<MotivationAccrualService>() as unknown as MotivationAccrualService,
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
    jest.mocked(prisma.order.findFirst).mockResolvedValue(null);
    const res = await service.getCloseValidation(ctx, 'o1');
    expect(res).toEqual({ canClose: false, closeDeficiencies: [] });
  });

  it('закрытый/отменённый статус → нельзя закрыть, без дефицитов', async () => {
    jest
      .mocked(prisma.order.findFirst)
      .mockResolvedValue(order({ status: OrderStatus.CLOSED }) as any);
    const res = await service.getCloseValidation(ctx, 'o1');
    expect(res).toEqual({ canClose: false, closeDeficiencies: [] });
  });

  it('есть авто, но не указан пробег → MILEAGE_MISSING', async () => {
    jest
      .mocked(prisma.order.findFirst)
      .mockResolvedValue(order({ carId: 'car-1', mileage: null }) as any);
    const res = await service.getCloseValidation(ctx, 'o1');
    expect(res.closeDeficiencies).toContain('MILEAGE_MISSING');
    expect(res.canClose).toBe(false);
  });

  it('работа (type=1) без исполнителя, в т.ч. вложенная → SERVICES_WITHOUT_WORKER', async () => {
    jest.mocked(prisma.order.findFirst).mockResolvedValue(
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
    jest.mocked(prisma.order.findFirst).mockResolvedValue(
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
    jest.mocked(prisma.order.findFirst).mockResolvedValue(
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
    jest.mocked(prisma.order.findFirst).mockResolvedValue(
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

  it('гарантийная работа без плательщика → WARRANTY_WITHOUT_PAYER', async () => {
    jest.mocked(prisma.order.findFirst).mockResolvedValue(
      order({
        items: [
          {
            type: '1',
            service: {
              executorId: 'person-1',
              executorKind: 'PERSON',
              warranty: true,
              warrantyPayerKind: null,
              warrantyPayerPersonId: null,
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

  it('гарантийная запчасть без плательщика → WARRANTY_WITHOUT_PAYER', async () => {
    jest.mocked(prisma.order.findFirst).mockResolvedValue(
      order({
        items: [
          {
            type: '2',
            part: {
              warranty: true,
              warrantyPayerKind: null,
              warrantyPayerPersonId: null,
            },
            children: [],
          },
        ],
      }) as any,
    );
    const res = await service.getCloseValidation(ctx, 'o1');
    expect(res.closeDeficiencies).toContain('WARRANTY_WITHOUT_PAYER');
  });

  it('гарантия с плательщиком ORGANIZATION (работа и запчасть) → без дефицита', async () => {
    jest.mocked(prisma.order.findFirst).mockResolvedValue(
      order({
        items: [
          {
            type: '1',
            service: {
              executorId: 'person-1',
              executorKind: 'PERSON',
              warranty: true,
              warrantyPayerKind: 'ORGANIZATION',
              warrantyPayerPersonId: null,
            },
            children: [
              {
                type: '2',
                part: {
                  warranty: true,
                  warrantyPayerKind: 'ORGANIZATION',
                  warrantyPayerPersonId: null,
                },
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

  it('гарантия с плательщиком-сотрудником без ставки → WARRANTY_PAYER_NOT_ELIGIBLE', async () => {
    jest.mocked(prisma.order.findFirst).mockResolvedValue(
      order({
        items: [
          {
            type: '1',
            service: {
              executorId: 'person-1',
              executorKind: 'PERSON',
              warranty: true,
              warrantyPayerKind: 'EMPLOYEE',
              warrantyPayerPersonId: 'person-1',
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
    expect(res.closeDeficiencies).toContain('WARRANTY_PAYER_NOT_ELIGIBLE');
  });

  it('гарантия с плательщиком-сотрудником уволенным → WARRANTY_PAYER_NOT_ELIGIBLE', async () => {
    jest.mocked(prisma.order.findFirst).mockResolvedValue(
      order({
        items: [
          {
            type: '2',
            part: {
              warranty: true,
              warrantyPayerKind: 'EMPLOYEE',
              warrantyPayerPersonId: 'person-2',
            },
            children: [],
          },
        ],
      }) as any,
    );
    employeeService.findByPersonId.mockResolvedValue({
      id: 'emp-2',
      personId: 'person-2',
      ratio: 40,
      firedAt: new Date(),
    } as any);
    const res = await service.getCloseValidation(ctx, 'o1');
    expect(res.closeDeficiencies).toContain('WARRANTY_PAYER_NOT_ELIGIBLE');
  });

  it('гарантия с плательщиком-сотрудником со ставкой (исполнитель или другой) → без дефицита', async () => {
    jest.mocked(prisma.order.findFirst).mockResolvedValue(
      order({
        items: [
          {
            type: '1',
            service: {
              executorId: 'person-1',
              executorKind: 'PERSON',
              warranty: true,
              warrantyPayerKind: 'EMPLOYEE',
              warrantyPayerPersonId: 'person-2',
            },
            children: [],
          },
        ],
      }) as any,
    );
    employeeService.findByPersonId.mockResolvedValue({
      id: 'emp-2',
      personId: 'person-2',
      ratio: 40,
      firedAt: null,
    } as any);
    const res = await service.getCloseValidation(ctx, 'o1');
    expect(res).toEqual({ canClose: true, closeDeficiencies: [] });
  });
});

describe('OrderService calendar entry order link', () => {
  let prisma: PrismaMock;
  let auditLog: DeepMockProxy<AuditLogService>;
  let service: OrderService;
  const ctx = makeCtx();
  const entryId = 'entry-1';
  const orderId = 'order-1';

  const deletableOrder = {
    createdAt: new Date(),
    close: null,
    _count: { items: 0 },
  };

  const setupService = () => {
    prisma = createPrismaMock();
    auditLog = mockDeep<AuditLogService>();
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
      auditLog as unknown as AuditLogService,
      mockDeep<EmployeeService>() as unknown as EmployeeService,
      mockDeep<ProfitService>() as unknown as ProfitService,
      mockDeep<TireStorageService>() as unknown as TireStorageService,
      mockDeep<CalendarService>() as unknown as CalendarService,
      mockDeep<MotivationAccrualService>() as unknown as MotivationAccrualService,
    );
  };

  const mockCreateFromEntry = () => {
    jest
      .mocked(prisma.calendarEntry.findFirst)
      .mockResolvedValue({ id: entryId } as any);
    jest.mocked(prisma.$queryRaw).mockResolvedValue([] as any);
    jest
      .mocked(prisma.order.aggregate)
      .mockResolvedValue({ _max: { number: 1 } } as any);
    jest.mocked(prisma.order.create).mockResolvedValue({
      id: orderId,
      tenantId: ctx.tenantId,
      number: 2,
      status: OrderStatus.WORKING,
    } as any);
    jest.mocked(prisma.calendarEntryOrder.create).mockResolvedValue({} as any);
    auditLog.record.mockResolvedValue(undefined as any);
  };

  beforeEach(() => {
    setupService();
  });

  it('deleteOrder удаляет связь calendar_entry_order', async () => {
    jest
      .mocked(prisma.order.findFirst)
      .mockResolvedValue(deletableOrder as any);
    jest
      .mocked(prisma.calendarEntryOrder.deleteMany)
      .mockResolvedValue({ count: 1 });
    jest.mocked(prisma.order.delete).mockResolvedValue({ id: orderId } as any);

    await service.deleteOrder(ctx, orderId);

    expect(prisma.calendarEntryOrder.deleteMany).toHaveBeenCalledWith({
      where: { orderId, tenantId: ctx.tenantId },
    });
    expect(prisma.order.delete).toHaveBeenCalledWith({
      where: { id: orderId },
    });
  });

  it('create → delete → create на том же entryId проходит', async () => {
    mockCreateFromEntry();
    jest.mocked(prisma.calendarEntryOrder.findFirst).mockResolvedValue(null);

    const created = await service.create(ctx, { entryId });
    expect(created.id).toBe(orderId);

    jest
      .mocked(prisma.order.findFirst)
      .mockResolvedValue(deletableOrder as any);
    jest
      .mocked(prisma.calendarEntryOrder.deleteMany)
      .mockResolvedValue({ count: 1 });
    jest.mocked(prisma.order.delete).mockResolvedValue({ id: orderId } as any);
    await service.deleteOrder(ctx, orderId);

    jest.mocked(prisma.calendarEntryOrder.findFirst).mockResolvedValue(null);
    jest.mocked(prisma.order.create).mockResolvedValue({
      id: 'order-2',
      tenantId: ctx.tenantId,
      number: 3,
      status: OrderStatus.WORKING,
    } as any);

    const recreated = await service.create(ctx, { entryId });
    expect(recreated.id).toBe('order-2');
    expect(prisma.calendarEntryOrder.create).toHaveBeenCalledTimes(2);
  });

  it('create с сиротской связью очищает link и создаёт заказ', async () => {
    mockCreateFromEntry();
    jest.mocked(prisma.calendarEntryOrder.findFirst).mockResolvedValue({
      orderId: 'deleted-order',
    } as any);
    jest.mocked(prisma.order.findFirst).mockResolvedValue(null);

    const created = await service.create(ctx, { entryId });

    expect(prisma.calendarEntryOrder.deleteMany).toHaveBeenCalledWith({
      where: { entryId, tenantId: ctx.tenantId },
    });
    expect(created.id).toBe(orderId);
  });

  it('create с живой связью отклоняет дубль', async () => {
    mockCreateFromEntry();
    jest.mocked(prisma.calendarEntryOrder.findFirst).mockResolvedValue({
      orderId: 'existing-order',
    } as any);
    jest
      .mocked(prisma.order.findFirst)
      .mockResolvedValue({ id: 'existing-order' } as any);

    await expect(service.create(ctx, { entryId })).rejects.toThrow(
      'Для этой записи уже создан заказ',
    );
  });
});

describe('OrderService.getCalendarEntry', () => {
  let calendarService: DeepMockProxy<CalendarService>;
  let service: OrderService;
  const ctx = makeCtx();

  beforeEach(() => {
    calendarService = mockDeep<CalendarService>();
    service = new OrderService(
      createPrismaMock() as unknown as PrismaService,
      mockDeep<WalletTransactionService>() as unknown as WalletTransactionService,
      mockDeep<SalaryService>() as unknown as SalaryService,
      mockDeep<CustomerTransactionService>() as unknown as CustomerTransactionService,
      mockDeep<SettingsService>() as unknown as SettingsService,
      mockDeep<WarehouseService>() as unknown as WarehouseService,
      mockDeep<OrganizationService>() as unknown as OrganizationService,
      mockDeep<TasksService>() as unknown as TasksService,
      mockDeep<RecommendationWorkMigrationService>() as unknown as RecommendationWorkMigrationService,
      mockDeep<AuditLogService>() as unknown as AuditLogService,
      mockDeep<EmployeeService>() as unknown as EmployeeService,
      mockDeep<ProfitService>() as unknown as ProfitService,
      mockDeep<TireStorageService>() as unknown as TireStorageService,
      calendarService as unknown as CalendarService,
      mockDeep<MotivationAccrualService>() as unknown as MotivationAccrualService,
    );
  });

  it('без связи возвращает null', async () => {
    calendarService.getEntryForOrder.mockResolvedValue(null);
    await expect(service.getCalendarEntry(ctx, 'o1')).resolves.toBeNull();
  });

  it('возвращает актуальную запись календаря', async () => {
    const entry = {
      id: 'entry-1',
      createdAt: new Date('2026-08-01'),
      calendarEntryOrderInfo: [
        { description: 'Комментарий', createdAt: new Date() },
      ],
    };
    calendarService.getEntryForOrder.mockResolvedValue(entry as any);

    await expect(service.getCalendarEntry(ctx, 'o1')).resolves.toEqual(entry);
    expect(calendarService.getEntryForOrder).toHaveBeenCalledWith(ctx, 'o1');
  });
});

describe('OrderService.canDeleteOrder', () => {
  let prisma: PrismaMock;
  let settingsService: DeepMockProxy<SettingsService>;
  let service: OrderService;
  const ctx = makeCtx();
  const hoursAgo = (hours: number) => new Date(Date.now() - hours * 3_600_000);

  beforeEach(() => {
    prisma = createPrismaMock();
    settingsService = mockDeep<SettingsService>();
    service = new OrderService(
      prisma,
      mockDeep<WalletTransactionService>(),
      mockDeep<SalaryService>(),
      mockDeep<CustomerTransactionService>(),
      settingsService,
      mockDeep<WarehouseService>(),
      mockDeep<OrganizationService>(),
      mockDeep<TasksService>(),
      mockDeep<RecommendationWorkMigrationService>(),
      mockDeep<AuditLogService>(),
      mockDeep<EmployeeService>(),
      mockDeep<ProfitService>(),
      mockDeep<TireStorageService>(),
      mockDeep<CalendarService>(),
      mockDeep<MotivationAccrualService>(),
    );
  });

  const emptyOrder = (createdAt: Date) =>
    ({ createdAt, close: null, _count: { items: 0 } }) as never;

  it('окно удаления берётся из настроек тенанта', async () => {
    settingsService.getOrderDeleteCoolingHours.mockResolvedValue(1);
    prisma.order.findFirst.mockResolvedValue(emptyOrder(hoursAgo(2)));

    await expect(service.canDeleteOrder(ctx, 'o1')).resolves.toBe(false);
    expect(settingsService.getOrderDeleteCoolingHours.mock.calls).toEqual([
      [ctx.tenantId],
    ]);
  });

  it('в пределах окна пустой заказ удаляется', async () => {
    settingsService.getOrderDeleteCoolingHours.mockResolvedValue(3);
    prisma.order.findFirst.mockResolvedValue(emptyOrder(hoursAgo(2)));

    await expect(service.canDeleteOrder(ctx, 'o1')).resolves.toBe(true);
  });
});

describe('OrderService.cancelOrder: предоплата', () => {
  let prisma: PrismaMock;
  let customerTransactions: DeepMockProxy<CustomerTransactionService>;
  let service: OrderService;
  const ctx = makeCtx();
  const input = { orderId: 'o1', reasonCode: 'duplicate_order' };

  const openOrder = (customerId: string | null) =>
    prisma.order.findFirst.mockResolvedValue({
      id: 'o1',
      number: 7,
      status: OrderStatus.WORKING,
      customerId,
    } as never);

  beforeEach(() => {
    prisma = createPrismaMock();
    customerTransactions = mockDeep<CustomerTransactionService>();
    const settingsService = mockDeep<SettingsService>();
    settingsService.getDefaultCurrencyCode.mockResolvedValue('RUB');
    service = new OrderService(
      prisma,
      mockDeep<WalletTransactionService>(),
      mockDeep<SalaryService>(),
      customerTransactions,
      settingsService,
      mockDeep<WarehouseService>(),
      mockDeep<OrganizationService>(),
      mockDeep<TasksService>(),
      mockDeep<RecommendationWorkMigrationService>(),
      mockDeep<AuditLogService>(),
      mockDeep<EmployeeService>(),
      mockDeep<ProfitService>(),
      mockDeep<TireStorageService>(),
      mockDeep<CalendarService>(),
      mockDeep<MotivationAccrualService>(),
    );
    jest.spyOn(service, 'findOne').mockResolvedValue({} as never);
    prisma.orderClose.create.mockResolvedValue({ id: 'close-1' } as never);
    prisma.orderItemPart.findMany.mockResolvedValue([]);
  });

  it('предоплаты и возвраты переходят на счёт заказчика', async () => {
    openOrder('customer-1');
    prisma.orderPayment.findMany.mockResolvedValue([
      { amountAmount: 50_000n, amountCurrencyCode: 'RUB' },
      { amountAmount: -20_000n, amountCurrencyCode: 'RUB' },
    ] as never);

    await service.cancelOrder(ctx, input);

    expect(
      customerTransactions.createWithinTransaction.mock.calls.map(
        ([, data]) => [data.operandId, data.source, data.amount?.amountMinor],
      ),
    ).toEqual([
      ['customer-1', CustomerTransactionSource.OrderPrepay, 50_000n],
      ['customer-1', CustomerTransactionSource.OrderPrepayRefund, -20_000n],
    ]);
  });

  it('без заказчика с предоплатой отмена запрещена', async () => {
    openOrder(null);
    prisma.orderPayment.aggregate.mockResolvedValue({
      _sum: { amountAmount: 30_000n },
    } as never);

    await expect(service.cancelOrder(ctx, input)).rejects.toThrow(
      'верните предоплату',
    );
    expect(prisma.$transaction.mock.calls).toHaveLength(0);
  });

  it('без заказчика и без предоплаты отменяется', async () => {
    openOrder(null);
    prisma.orderPayment.aggregate.mockResolvedValue({
      _sum: { amountAmount: null },
    } as never);

    await service.cancelOrder(ctx, input);

    expect(prisma.orderCancel.create.mock.calls).toHaveLength(1);
    expect(
      customerTransactions.createWithinTransaction.mock.calls,
    ).toHaveLength(0);
  });
});
