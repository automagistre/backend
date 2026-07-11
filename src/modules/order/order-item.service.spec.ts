import { mockDeep, type DeepMockProxy } from 'jest-mock-extended';
import { BadRequestException } from '@nestjs/common';
import { OrderItemService } from './order-item.service';
import { OrderService } from './order.service';
import { ReservationService } from '../reservation/reservation.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { SettingsService } from 'src/modules/settings/settings.service';
import { AuditLogService } from 'src/modules/audit-log/audit-log.service';
import { WalletTransactionService } from 'src/modules/wallet/wallet-transaction.service';
import { AuditEntityType } from 'src/modules/audit-log/enums/audit.enums';
import { PartyKind } from 'src/common/party';
import { createPrismaMock, type PrismaMock } from 'src/common/testing/prisma-mock';
import { makeCtx } from 'src/common/testing/auth-context';

describe('OrderItemService.createService', () => {
  let prisma: PrismaMock;
  let orderService: DeepMockProxy<OrderService>;
  let settings: DeepMockProxy<SettingsService>;
  let audit: DeepMockProxy<AuditLogService>;
  let walletTransactions: DeepMockProxy<WalletTransactionService>;
  let service: OrderItemService;
  const ctx = makeCtx();

  beforeEach(() => {
    prisma = createPrismaMock();
    orderService = mockDeep<OrderService>();
    settings = mockDeep<SettingsService>();
    audit = mockDeep<AuditLogService>();
    walletTransactions = mockDeep<WalletTransactionService>();
    settings.getDefaultCurrencyCode.mockResolvedValue('RUB');
    orderService.validateOrderEditable.mockResolvedValue(undefined as any);

    service = new OrderItemService(
      prisma as unknown as PrismaService,
      orderService as unknown as OrderService,
      mockDeep<ReservationService>() as unknown as ReservationService,
      settings as unknown as SettingsService,
      audit as unknown as AuditLogService,
      walletTransactions as unknown as WalletTransactionService,
    );
  });

  const created = (over: Record<string, any> = {}) => ({
    id: 'oi-1',
    parentId: null,
    type: '1',
    service: { id: 's1', service: 'Работа', ...over },
  });

  it('маппит executor {PERSON,id} в executorKind/executorId и пишет аудит', async () => {
    prisma.orderItem.create.mockResolvedValue(created() as any);

    await service.createService(ctx, {
      orderId: 'order-1',
      service: 'Работа',
      executor: { kind: PartyKind.PERSON, id: 'person-1' },
    } as any);

    const data = prisma.orderItem.create.mock.calls[0][0].data as any;
    expect(data.service.create).toMatchObject({
      executorKind: PartyKind.PERSON,
      executorId: 'person-1',
      priceAmount: 0n,
      discountAmount: 0n,
    });
    expect(audit.record).toHaveBeenCalledTimes(1);
    const auditArg = audit.record.mock.calls[0][2];
    expect(auditArg.entityType).toBe(AuditEntityType.ORDER_ITEM_SERVICE);
  });

  it('без исполнителя пишет executorKind/executorId = null', async () => {
    prisma.orderItem.create.mockResolvedValue(created() as any);

    await service.createService(ctx, {
      orderId: 'order-1',
      service: 'Работа',
    } as any);

    const data = prisma.orderItem.create.mock.calls[0][0].data as any;
    expect(data.service.create.executorKind).toBeNull();
    expect(data.service.create.executorId).toBeNull();
  });

  it('применяет цену/скидку с валютой по умолчанию', async () => {
    prisma.orderItem.create.mockResolvedValue(created() as any);

    await service.createService(ctx, {
      orderId: 'order-1',
      service: 'Работа',
      price: { amountMinor: 500000n },
      discount: { amountMinor: 50000n },
    } as any);

    const data = prisma.orderItem.create.mock.calls[0][0].data as any;
    expect(data.service.create).toMatchObject({
      priceAmount: 500000n,
      priceCurrencyCode: 'RUB',
      discountAmount: 50000n,
      discountCurrencyCode: 'RUB',
    });
  });

  it('проверяет редактируемость заказа перед созданием', async () => {
    prisma.orderItem.create.mockResolvedValue(created() as any);
    await service.createService(ctx, {
      orderId: 'order-1',
      service: 'Работа',
    } as any);
    expect(orderService.validateOrderEditable).toHaveBeenCalledWith(
      ctx,
      'order-1',
    );
  });

  describe('подрядная работа (kind=CONTRACTOR)', () => {
    beforeEach(() => {
      prisma.employee.findFirst.mockResolvedValue(null);
    });

    it('сотрудник не может быть исполнителем подрядной работы', async () => {
      prisma.employee.findFirst.mockResolvedValue({ id: 'emp-1' } as any);

      await expect(
        service.createService(ctx, {
          orderId: 'order-1',
          service: 'Работа',
          kind: 'CONTRACTOR',
          executor: { kind: PartyKind.PERSON, id: 'person-1' },
        } as any),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('организация не может быть исполнителем своей работы (AUTOSERVICE)', async () => {
      await expect(
        service.createService(ctx, {
          orderId: 'order-1',
          service: 'Работа',
          executor: { kind: PartyKind.ORGANIZATION, id: 'org-1' },
        } as any),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('себестоимость недопустима для своей работы', async () => {
      await expect(
        service.createService(ctx, {
          orderId: 'order-1',
          service: 'Работа',
          cost: { amountMinor: 100n },
        } as any),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('себестоимость без счёта оплаты — ошибка', async () => {
      await expect(
        service.createService(ctx, {
          orderId: 'order-1',
          service: 'Работа',
          kind: 'CONTRACTOR',
          executor: { kind: PartyKind.ORGANIZATION, id: 'org-1' },
          cost: { amountMinor: 100n },
        } as any),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('создание с себестоимостью и счётом — маппит поля и синкает проводку', async () => {
      prisma.orderItem.create.mockResolvedValue(
        created({
          kind: 'CONTRACTOR',
          executorKind: 'ORGANIZATION',
          executorId: 'org-1',
          costAmount: 500000n,
          costCurrencyCode: 'RUB',
          costWalletId: 'w1',
        }) as any,
      );

      await service.createService(ctx, {
        orderId: 'order-1',
        service: 'Работа',
        kind: 'CONTRACTOR',
        executor: { kind: PartyKind.ORGANIZATION, id: 'org-1' },
        cost: { amountMinor: 500000n },
        costWalletId: 'w1',
      } as any);

      const data = prisma.orderItem.create.mock.calls[0][0].data as any;
      expect(data.service.create).toMatchObject({
        kind: 'CONTRACTOR',
        executorKind: PartyKind.ORGANIZATION,
        executorId: 'org-1',
        costAmount: 500000n,
        costCurrencyCode: 'RUB',
        costWalletId: 'w1',
      });
      expect(walletTransactions.syncContractorPayout).toHaveBeenCalledTimes(1);
      const syncArg = walletTransactions.syncContractorPayout.mock.calls[0][2];
      expect(syncArg).toMatchObject({
        serviceId: 'oi-1',
        orderId: 'order-1',
        kind: 'CONTRACTOR',
        costAmount: 500000n,
        costWalletId: 'w1',
      });
    });
  });
});
