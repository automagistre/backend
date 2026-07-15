import { BadRequestException } from '@nestjs/common';
import { mockDeep, type DeepMockProxy } from 'jest-mock-extended';
import { PrismaService } from 'src/prisma/prisma.service';
import { CogsService } from 'src/modules/cogs/cogs.service';
import { EmployeeService } from 'src/modules/employee/employee.service';
import { SettingsService } from 'src/modules/settings/settings.service';
import { ProfitService } from './profit.service';
import { ProfitCostBasis } from './enums/profit-cost-basis.enum';
import { ProfitLineKind } from './enums/profit-line-kind.enum';
import { ProfitOrigin } from './enums/profit-origin.enum';
import { WarrantyPayerKind } from 'src/modules/order/enums/warranty-payer-kind.enum';

describe('ProfitService.snapshotOrder', () => {
  let prisma: DeepMockProxy<PrismaService>;
  let cogs: DeepMockProxy<CogsService>;
  let employee: DeepMockProxy<EmployeeService>;
  let settings: DeepMockProxy<SettingsService>;
  let service: ProfitService;

  const ctx = { tenantId: 'tenant-1', userId: 'user-1' } as any;
  const closedAt = new Date('2026-07-13T10:00:00Z');

  beforeEach(() => {
    prisma = mockDeep<PrismaService>();
    cogs = mockDeep<CogsService>();
    employee = mockDeep<EmployeeService>();
    settings = mockDeep<SettingsService>();

    settings.getDefaultCurrencyCode.mockResolvedValue('RUB');
    jest.mocked(prisma.$transaction).mockImplementation(async (cb: any) => cb(prisma));

    service = new ProfitService(
      prisma as unknown as PrismaService,
      cogs as unknown as CogsService,
      employee as unknown as EmployeeService,
      settings as unknown as SettingsService,
    );
  });

  const tx = {
    order: { findFirst: jest.fn() },
    orderItem: { findMany: jest.fn() },
    orderItemProfit: { deleteMany: jest.fn(), createMany: jest.fn() },
  } as any;

  it('записывает строки по работе, подрядчику и запчасти', async () => {
    jest.mocked(tx.order.findFirst).mockResolvedValue({ id: 'order-1', tenantId: 'tenant-1' });
    jest.mocked(tx.orderItem.findMany).mockResolvedValue([
      {
        id: 'svc-1',
        service: {
          kind: 'AUTOSERVICE',
          executorKind: 'PERSON',
          executorId: 'person-1',
          warranty: false,
          warrantyPayerKind: null,
          priceAmount: 10000n,
          discountAmount: 0n,
          costAmount: null,
        },
        part: null,
      },
      {
        id: 'svc-2',
        service: {
          kind: 'CONTRACTOR',
          executorKind: 'ORGANIZATION',
          executorId: 'org-1',
          warranty: false,
          warrantyPayerKind: null,
          priceAmount: 100000n,
          discountAmount: 0n,
          costAmount: 80000n,
        },
        part: null,
      },
      {
        id: 'part-1',
        service: null,
        part: {
          partId: 'part-1',
          quantity: 100,
          warranty: false,
          warrantyPayerKind: null,
          priceAmount: 5000n,
          discountAmount: 0n,
        },
      },
    ]);
    employee.findByPersonId.mockResolvedValue({
      personId: 'person-1',
      ratio: 30,
      firedAt: null,
    } as any);
    cogs.getPartLineCogsAtDate.mockResolvedValue(3000n);

    const count = await service.snapshotOrder(
      tx,
      ctx,
      'order-1',
      closedAt,
      ProfitOrigin.LIVE,
    );

    expect(count).toBe(3);
    expect(tx.orderItemProfit.deleteMany).toHaveBeenCalledWith({
      where: { orderId: 'order-1' },
    });
    expect(tx.orderItemProfit.createMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        expect.objectContaining({
          orderItemId: 'svc-1',
          kind: ProfitLineKind.SERVICE,
          revenueAmount: 10000n,
          costAmount: 3000n,
          profitAmount: 7000n,
          costBasis: ProfitCostBasis.SALARY,
          origin: ProfitOrigin.LIVE,
        }),
        expect.objectContaining({
          orderItemId: 'svc-2',
          kind: ProfitLineKind.SERVICE,
          revenueAmount: 100000n,
          costAmount: 80000n,
          profitAmount: 20000n,
          costBasis: ProfitCostBasis.CONTRACTOR,
        }),
        expect.objectContaining({
          orderItemId: 'part-1',
          kind: ProfitLineKind.PART,
          revenueAmount: 5000n,
          costAmount: 3000n,
          profitAmount: 2000n,
          costBasis: ProfitCostBasis.LAST_INCOME,
        }),
      ]),
    });
  });

  it('гарантия работа с плательщиком-сотрудником: profit=0, costBasis=NONE', async () => {
    jest.mocked(tx.order.findFirst).mockResolvedValue({ id: 'order-1', tenantId: 'tenant-1' });
    jest.mocked(tx.orderItem.findMany).mockResolvedValue([
      {
        id: 'svc-1',
        service: {
          kind: 'AUTOSERVICE',
          executorKind: 'PERSON',
          executorId: 'person-1',
          warranty: true,
          warrantyPayerKind: WarrantyPayerKind.EMPLOYEE,
          warrantyPayerPersonId: 'person-1',
          priceAmount: 10000n,
          discountAmount: 0n,
          costAmount: null,
        },
        part: null,
      },
    ]);
    employee.findByPersonId.mockResolvedValue({
      personId: 'person-1',
      ratio: 30,
      firedAt: null,
    } as any);

    await service.snapshotOrder(tx, ctx, 'order-1', closedAt);

    expect(tx.orderItemProfit.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          revenueAmount: 0n,
          costAmount: 0n,
          profitAmount: 0n,
          costBasis: ProfitCostBasis.NONE,
          warranty: true,
        }),
      ],
    });
  });

  it('recomputeOrderProfit отклоняет отменённый заказ', async () => {
    jest.mocked(prisma.order.findFirst).mockResolvedValue({
      close: {
        orderCancel: { id: 'cancel-1' },
        orderDeal: { createdAt: closedAt },
      },
    } as any);

    await expect(
      service.recomputeOrderProfit(ctx, 'order-1'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('ProfitService.getPeriodProfit', () => {
  let prisma: DeepMockProxy<PrismaService>;
  let settings: DeepMockProxy<SettingsService>;
  let service: ProfitService;

  const ctx = { tenantId: 'tenant-1', userId: 'user-1' } as any;
  const emptyAgg = {
    _sum: { revenueAmount: 0n, costAmount: 0n, profitAmount: 0n },
  };

  beforeEach(() => {
    prisma = mockDeep<PrismaService>();
    settings = mockDeep<SettingsService>();
    settings.getTimezone.mockResolvedValue('Europe/Moscow');
    jest.mocked(prisma.incomeAccrue.aggregate).mockResolvedValue({
      _min: { createdAt: new Date('2020-01-01T00:00:00Z') },
    } as any);
    jest.mocked(prisma.orderItemProfit.aggregate).mockResolvedValue(emptyAgg as any);
    jest.mocked(prisma.orderItemProfit.groupBy).mockResolvedValue([]);

    service = new ProfitService(
      prisma as unknown as PrismaService,
      mockDeep<CogsService>() as unknown as CogsService,
      mockDeep<EmployeeService>() as unknown as EmployeeService,
      settings as unknown as SettingsService,
    );
  });

  it('включает закрытые сделки до конца последнего дня в TZ тенанта', async () => {
    // DatePicker: 14.07.2026 00:00 MSK → 13.07.2026T21:00:00.000Z
    const dateFrom = new Date('2026-07-01T00:00:00.000+03:00');
    const dateTo = new Date('2026-07-14T00:00:00.000+03:00');

    await service.getPeriodProfit(ctx, dateFrom, dateTo);

    const where = (jest.mocked(prisma.orderItemProfit.aggregate).mock.calls[0][0] as any)
      .where.closedAt;
    expect(where.gte).toEqual(new Date('2026-07-01T00:00:00.000+03:00'));
    expect(where.lt).toEqual(new Date('2026-07-15T00:00:00.000+03:00'));
  });
});

describe('ProfitService.findItemProfitRows', () => {
  let prisma: DeepMockProxy<PrismaService>;
  let service: ProfitService;

  const ctx = { tenantId: 'tenant-1', userId: 'user-1' } as any;

  beforeEach(() => {
    prisma = mockDeep<PrismaService>();
    service = new ProfitService(
      prisma as unknown as PrismaService,
      mockDeep<CogsService>() as unknown as CogsService,
      mockDeep<EmployeeService>() as unknown as EmployeeService,
      mockDeep<SettingsService>() as unknown as SettingsService,
    );
  });

  it('загружает строки снапшота по orderId', async () => {
    jest.mocked(prisma.orderItemProfit.findMany).mockResolvedValue([
      { id: 'profit-1', profitAmount: 1000n },
    ] as any);

    const rows = await service.findItemProfitRows(ctx, 'order-1');

    expect(rows).toHaveLength(1);
    expect(prisma.orderItemProfit.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { orderId: 'order-1', tenantId: 'tenant-1' },
      }),
    );
  });
});
