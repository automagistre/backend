import { mockDeep, type DeepMockProxy } from 'jest-mock-extended';
import { BadRequestException } from '@nestjs/common';
import { OrderItemService } from './order-item.service';
import { OrderService } from './order.service';
import { ReservationService } from '../reservation/reservation.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { SettingsService } from 'src/modules/settings/settings.service';
import { AuditLogService } from 'src/modules/audit-log/audit-log.service';
import { WalletTransactionService } from 'src/modules/wallet/wallet-transaction.service';
import { NoteService } from 'src/modules/note/note.service';
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
  let noteService: DeepMockProxy<NoteService>;
  let service: OrderItemService;
  const ctx = makeCtx();

  beforeEach(() => {
    prisma = createPrismaMock();
    orderService = mockDeep<OrderService>();
    settings = mockDeep<SettingsService>();
    audit = mockDeep<AuditLogService>();
    walletTransactions = mockDeep<WalletTransactionService>();
    noteService = mockDeep<NoteService>();
    settings.getDefaultCurrencyCode.mockResolvedValue('RUB');
    orderService.validateOrderEditable.mockResolvedValue(undefined as any);

    service = new OrderItemService(
      prisma as unknown as PrismaService,
      orderService as unknown as OrderService,
      mockDeep<ReservationService>() as unknown as ReservationService,
      settings as unknown as SettingsService,
      audit as unknown as AuditLogService,
      walletTransactions as unknown as WalletTransactionService,
      noteService as unknown as NoteService,
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

  describe('applyWarranty', () => {
    const mockApplyWarrantyQueries = (
      fullItems: unknown[],
      allItems: unknown[] = [],
      assigneeId: string | null = 'person-1',
    ) => {
      prisma.order.findFirst.mockResolvedValue({ assigneeId } as any);
      prisma.orderItem.findMany.mockImplementation(((args: any) => {
        if (args?.where?.orderId && !args?.where?.id) {
          return Promise.resolve(allItems as any);
        }
        if (args?.where?.id?.in) {
          const ids = args.where.id.in as string[];
          return Promise.resolve(
            (fullItems as any[]).filter((item) => ids.includes(item.id)),
          );
        }
        return Promise.resolve(fullItems as any);
      }) as any);
    };

    const serviceItem = (over: Record<string, any> = {}) => ({
      id: 'svc-item-1',
      orderId: 'order-1',
      parentId: null,
      service: {
        id: 'svc-item-1',
        service: 'Ремонт подвески',
        kind: 'AUTOSERVICE',
        executorKind: 'PERSON',
        executorId: 'person-1',
        costAmount: null,
        costCurrencyCode: null,
        costWalletId: null,
        ...over,
      },
      part: null,
    });

    const partItem = (over: Record<string, any> = {}) => ({
      id: 'part-item-1',
      orderId: 'order-1',
      parentId: 'svc-item-1',
      service: null,
      part: {
        id: 'part-item-1',
        partId: 'part-1',
        part: { id: 'part-1', name: 'Подшипник' },
        quantity: 100,
        ...over,
      },
    });

    it('бросает ошибку, если не выбрано ни одной позиции', async () => {
      await expect(
        service.applyWarranty(ctx, {
          orderId: 'order-1',
          itemIds: [],
          warranty: true,
          reason: 'Брак',
        } as any),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('бросает ошибку, если warranty=true без причины', async () => {
      mockApplyWarrantyQueries([serviceItem()]);

      await expect(
        service.applyWarranty(ctx, {
          orderId: 'order-1',
          itemIds: ['svc-item-1'],
          warranty: true,
          workPayer: 'EXECUTOR',
          reason: '   ',
        } as any),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('бросает ошибку, если есть работы, но не указан workPayer', async () => {
      mockApplyWarrantyQueries([serviceItem()]);

      await expect(
        service.applyWarranty(ctx, {
          orderId: 'order-1',
          itemIds: ['svc-item-1'],
          warranty: true,
          reason: 'Брак',
        } as any),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('бросает ошибку, если есть запчасти, но не указан partsPayer', async () => {
      mockApplyWarrantyQueries([partItem()]);

      await expect(
        service.applyWarranty(ctx, {
          orderId: 'order-1',
          itemIds: ['part-item-1'],
          warranty: true,
          reason: 'Брак',
        } as any),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('помечает работу и запчасть гарантийными, синкает payout, upsert Note', async () => {
      mockApplyWarrantyQueries(
        [serviceItem(), partItem()],
        [
          {
            id: 'svc-item-1',
            parentId: null,
            service: {
              kind: 'AUTOSERVICE',
              executorKind: 'PERSON',
              executorId: 'person-1',
            },
          },
        ],
      );
      noteService.upsertWarrantyNote.mockResolvedValue({ id: 'note-1' } as any);

      const result = await service.applyWarranty(ctx, {
        orderId: 'order-1',
        itemIds: ['svc-item-1', 'part-item-1'],
        warranty: true,
        workPayer: 'EXECUTOR',
        partsPayer: 'ORGANIZATION',
        reason: 'Повторный выезд',
      } as any);

      expect(prisma.orderItemService.update).toHaveBeenCalledWith({
        where: { id: 'svc-item-1' },
        data: { warranty: true, warrantyPayer: 'EXECUTOR' },
      });
      expect(prisma.orderItemPart.update).toHaveBeenCalledWith({
        where: { id: 'part-item-1' },
        data: { warranty: true, warrantyPayer: 'ORGANIZATION' },
      });
      expect(walletTransactions.syncContractorPayout).toHaveBeenCalledWith(
        prisma,
        ctx,
        expect.objectContaining({
          serviceId: 'svc-item-1',
          warranty: true,
          warrantyPayer: 'EXECUTOR',
        }),
      );
      expect(noteService.upsertWarrantyNote).toHaveBeenCalledWith(
        ctx,
        prisma,
        'order-1',
        'Повторный выезд',
        'EXECUTOR',
        'ORGANIZATION',
      );
      expect(result).toEqual({
        orderId: 'order-1',
        updatedCount: 2,
        noteId: 'note-1',
      });
    });

    it('для подрядной работы принудительно ставит ORGANIZATION, даже если передан EXECUTOR', async () => {
      mockApplyWarrantyQueries([
        serviceItem({
          kind: 'CONTRACTOR',
          executorKind: 'ORGANIZATION',
          executorId: 'org-1',
          costAmount: 50000n,
        }),
      ]);
      noteService.upsertWarrantyNote.mockResolvedValue({ id: 'note-1' } as any);

      await service.applyWarranty(ctx, {
        orderId: 'order-1',
        itemIds: ['svc-item-1'],
        warranty: true,
        workPayer: 'EXECUTOR',
        reason: 'Брак подрядчика',
      } as any);

      expect(prisma.orderItemService.update).toHaveBeenCalledWith({
        where: { id: 'svc-item-1' },
        data: { warranty: true, warrantyPayer: 'ORGANIZATION' },
      });
      expect(noteService.upsertWarrantyNote).toHaveBeenCalledWith(
        ctx,
        prisma,
        'order-1',
        'Брак подрядчика',
        'ORGANIZATION',
        null,
      );
    });

    it('корневая запчасть без ответственного → ORGANIZATION (правило 5)', async () => {
      mockApplyWarrantyQueries(
        [
          {
            id: 'part-item-1',
            orderId: 'order-1',
            parentId: null,
            service: null,
            part: {
              id: 'part-item-1',
              partId: 'part-1',
              part: { id: 'part-1', name: 'Генератор' },
              quantity: 100,
            },
          },
        ],
        [],
        null,
      );
      noteService.upsertWarrantyNote.mockResolvedValue({ id: 'note-1' } as any);

      await service.applyWarranty(ctx, {
        orderId: 'order-1',
        itemIds: ['part-item-1'],
        warranty: true,
        partsPayer: 'EXECUTOR',
        reason: 'Брак',
      } as any);

      expect(prisma.orderItemPart.update).toHaveBeenCalledWith({
        where: { id: 'part-item-1' },
        data: { warranty: true, warrantyPayer: 'ORGANIZATION' },
      });
    });

    it('при выборе только работы добавляет дочерние запчасти', async () => {
      mockApplyWarrantyQueries(
        [serviceItem(), partItem()],
        [
          { id: 'svc-item-1', parentId: 'group-1', type: '1', service: { kind: 'AUTOSERVICE', executorKind: 'PERSON', executorId: 'person-1' } },
          { id: 'part-item-1', parentId: 'svc-item-1', type: '2', service: null },
          { id: 'group-1', parentId: null, type: '3', service: null },
        ],
      );
      noteService.upsertWarrantyNote.mockResolvedValue({ id: 'note-1' } as any);

      await service.applyWarranty(ctx, {
        orderId: 'order-1',
        itemIds: ['svc-item-1'],
        warranty: true,
        workPayer: 'EXECUTOR',
        partsPayer: 'EXECUTOR',
        reason: 'Брак',
      } as any);

      expect(prisma.orderItemPart.update).toHaveBeenCalledWith({
        where: { id: 'part-item-1' },
        data: { warranty: true, warrantyPayer: 'EXECUTOR' },
      });
    });

    it('снятие гарантии обнуляет payer и не требует причину/Note', async () => {
      mockApplyWarrantyQueries([
        serviceItem({ warranty: true, warrantyPayer: 'EXECUTOR' }),
      ]);

      const result = await service.applyWarranty(ctx, {
        orderId: 'order-1',
        itemIds: ['svc-item-1'],
        warranty: false,
      } as any);

      expect(prisma.orderItemService.update).toHaveBeenCalledWith({
        where: { id: 'svc-item-1' },
        data: { warranty: false, warrantyPayer: null },
      });
      expect(noteService.upsertWarrantyNote).not.toHaveBeenCalled();
      expect(result.noteId).toBeNull();
    });

    it('снятие гарантии с работы снимает её и с дочерних запчастей', async () => {
      mockApplyWarrantyQueries(
        [
          serviceItem({ warranty: true, warrantyPayer: 'EXECUTOR' }),
          partItem({ warranty: true, warrantyPayer: 'EXECUTOR' }),
        ],
        [
          { id: 'svc-item-1', parentId: null, type: '1', service: { kind: 'AUTOSERVICE', executorKind: 'PERSON', executorId: 'person-1' } },
          { id: 'part-item-1', parentId: 'svc-item-1', type: '2', service: null },
        ],
      );

      await service.applyWarranty(ctx, {
        orderId: 'order-1',
        itemIds: ['svc-item-1'],
        warranty: false,
      } as any);

      expect(prisma.orderItemPart.update).toHaveBeenCalledWith({
        where: { id: 'part-item-1' },
        data: { warranty: false, warrantyPayer: null },
      });
    });
  });
});
