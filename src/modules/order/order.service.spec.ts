import { mockDeep } from 'jest-mock-extended';
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
import { OrderStatus } from './enums/order-status.enum';
import { createPrismaMock, type PrismaMock } from 'src/common/testing/prisma-mock';
import { makeCtx } from 'src/common/testing/auth-context';

describe('OrderService.getCloseValidation', () => {
  let prisma: PrismaMock;
  let service: OrderService;
  const ctx = makeCtx();

  beforeEach(() => {
    prisma = createPrismaMock();
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
});
