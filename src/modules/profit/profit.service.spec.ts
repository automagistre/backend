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
import { WarrantyPayer } from 'src/modules/order/enums/warranty-payer.enum';

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
    prisma.$transaction.mockImplementation(async (cb: any) => cb(prisma));

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
    tx.order.findFirst.mockResolvedValue({ id: 'order-1', tenantId: 'tenant-1' });
    tx.orderItem.findMany.mockResolvedValue([
      {
        id: 'svc-1',
        service: {
          kind: 'AUTOSERVICE',
          executorKind: 'PERSON',
          executorId: 'person-1',
          warranty: false,
          warrantyPayer: null,
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
          warrantyPayer: null,
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
          warrantyPayer: null,
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

  it('гарантия работа EXECUTOR: profit=0, costBasis=NONE', async () => {
    tx.order.findFirst.mockResolvedValue({ id: 'order-1', tenantId: 'tenant-1' });
    tx.orderItem.findMany.mockResolvedValue([
      {
        id: 'svc-1',
        service: {
          kind: 'AUTOSERVICE',
          executorKind: 'PERSON',
          executorId: 'person-1',
          warranty: true,
          warrantyPayer: WarrantyPayer.EXECUTOR,
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
    prisma.order.findFirst.mockResolvedValue({
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
