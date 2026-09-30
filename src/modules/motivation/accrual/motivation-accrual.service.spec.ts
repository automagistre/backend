/* eslint-disable @typescript-eslint/unbound-method -- jest-моки проверяются по ссылке на метод */
import { mockDeep, type DeepMockProxy } from 'jest-mock-extended';
import { Prisma } from 'src/generated/prisma/client';
import {
  createPrismaMock,
  type PrismaMock,
} from 'src/common/testing/prisma-mock';
import { makeCtx } from 'src/common/testing/auth-context';
import type { SettingsService } from 'src/modules/settings/settings.service';
import type { CustomerTransactionService } from 'src/modules/customer-transaction/customer-transaction.service';
import { CustomerTransactionSource } from 'src/modules/customer-transaction/enums/customer-transaction-source.enum';
import type { ProfitService } from 'src/modules/profit/profit.service';
import { buildTestScheme } from '../calculator/testing/test-scheme';
import type { MotivationFactsService } from '../facts/motivation-facts.service';
import type { MotivationFacts } from '../facts/motivation-facts.types';
import { OrderMotivationModeEnum } from '../models/motivation.enums';
import type {
  MotivationSchemeService,
  StoredMotivationScheme,
} from '../scheme/motivation-scheme.service';
import { MotivationAccrualService } from './motivation-accrual.service';

const MASTER = 'pos-master';
const ADMIN = 'pos-admin';
const PARTS = 'pos-parts';
const CLOSED_AT = new Date('2026-09-20T12:00:00Z');

const stored: StoredMotivationScheme = {
  id: 'scheme-1',
  version: 3,
  activeFrom: new Date('2026-09-01T00:00:00Z'),
  createdAt: new Date('2026-09-01T00:00:00Z'),
  scheme: buildTestScheme({ masterId: MASTER, adminId: ADMIN, partsId: PARTS }),
};

/** Работа без рекомендации: весь фонд — команде, перевёдшей её в заказ (60/40). */
const facts: MotivationFacts = {
  items: [
    {
      itemId: 'item-1',
      orderId: 'order-1',
      orderNumber: 101,
      closedAt: CLOSED_AT,
      label: 'Замена масла',
      type: 'SERVICE',
      profitMinor: 100_000n,
      notApplicable: ['RECOMMENDATION'],
      participants: {
        'SNAPSHOT:ITEM': [
          { employeeId: 'emp-master', positionId: MASTER },
          { employeeId: 'emp-admin', positionId: ADMIN },
        ],
      },
    },
  ],
  excluded: [
    {
      itemId: 'item-2',
      orderId: 'order-1',
      orderNumber: 101,
      type: 'SERVICE',
      label: 'Гарантия',
      profitMinor: 5_000n,
      reason: 'WARRANTY',
    },
  ],
};

describe('MotivationAccrualService', () => {
  let prisma: PrismaMock;
  let factsService: DeepMockProxy<MotivationFactsService>;
  let schemes: DeepMockProxy<MotivationSchemeService>;
  let profit: DeepMockProxy<ProfitService>;
  let transactions: DeepMockProxy<CustomerTransactionService>;
  let service: MotivationAccrualService;
  const ctx = makeCtx();
  let fired: Set<string>;

  const accrualRows = () =>
    prisma.motivationAccrual.createMany.mock.calls[0]?.[0]
      ?.data as Prisma.MotivationAccrualCreateManyInput[];

  const closedOrder = () =>
    prisma.order.findFirst.mockResolvedValue({
      id: 'order-1',
      number: 101,
      close: { orderDeal: { createdAt: CLOSED_AT }, orderCancel: null },
    } as never);

  beforeEach(() => {
    fired = new Set();
    prisma = createPrismaMock();
    factsService = mockDeep<MotivationFactsService>();
    schemes = mockDeep<MotivationSchemeService>();
    profit = mockDeep<ProfitService>();
    transactions = mockDeep<CustomerTransactionService>();
    const settings = mockDeep<SettingsService>();
    settings.getDefaultCurrencyCode.mockResolvedValue('RUB');
    service = new MotivationAccrualService(
      prisma,
      settings,
      factsService,
      schemes,
      profit,
      transactions,
    );

    prisma.orderItemProfit.findFirst.mockResolvedValue({
      closedAt: CLOSED_AT,
    } as never);
    prisma.motivationAccrual.findFirst.mockResolvedValue(null);
    prisma.customerTransaction.findFirst.mockResolvedValue(null);
    const employees = [
      {
        id: 'emp-master',
        personId: 'person-master',
        person: { lastname: 'Мастеров', firstname: 'Иван' },
      },
      {
        id: 'emp-admin',
        personId: 'person-admin',
        person: { lastname: 'Админов', firstname: 'Пётр' },
      },
    ];
    prisma.employee.findMany.mockImplementation(
      (args) =>
        Promise.resolve(
          args?.where?.firedAt
            ? employees.filter((employee) => fired.has(employee.id))
            : employees,
        ) as never,
    );
    prisma.staffPosition.findMany.mockResolvedValue([]);
    schemes.activeAt.mockResolvedValue(stored);
    factsService.byOrder.mockResolvedValue(facts);
    transactions.createWithinTransaction.mockImplementation(
      (_tx, data) => Promise.resolve({ id: `tx-${data.operandId}` }) as never,
    );
  });

  describe('chargeByOrder', () => {
    it('одна проводка на сотрудника и строки со ссылкой на неё', async () => {
      closedOrder();

      await service.chargeByOrder(ctx, 'order-1');

      expect(schemes.activeAt).toHaveBeenCalledWith(ctx.tenantId, CLOSED_AT);
      expect(transactions.createWithinTransaction).toHaveBeenCalledTimes(2);
      expect(transactions.createWithinTransaction).toHaveBeenCalledWith(
        prisma,
        {
          operandId: 'person-master',
          source: CustomerTransactionSource.OrderMotivation,
          sourceId: 'order-1',
          description: 'Премия по заказу №101',
          amount: { amountMinor: 6_000n, currencyCode: 'RUB' },
        },
        ctx.tenantId,
        ctx.userId,
      );
      const data = accrualRows();
      expect(
        data.map((row) => [
          row.employeeId,
          row.amountAmount,
          row.customerTransactionId,
        ]),
      ).toEqual([
        ['emp-admin', 4_000n, 'tx-person-admin'],
        ['emp-master', 6_000n, 'tx-person-master'],
      ]);
      expect(data.every((row) => row.schemeId === 'scheme-1')).toBe(true);
    });

    it('уволенный не получает, его доля остаётся организации', async () => {
      closedOrder();
      fired.add('emp-master');

      await service.chargeByOrder(ctx, 'order-1');

      expect(transactions.createWithinTransaction).toHaveBeenCalledTimes(1);
      expect(
        accrualRows().map((row) => [
          row.employeeId,
          row.amountAmount,
          row.outcome,
          row.reason,
          row.customerTransactionId,
        ]),
      ).toEqual([
        ['emp-admin', 4_000n, 'ACCRUED', null, 'tx-person-admin'],
        ['emp-master', 6_000n, 'KEPT_IN_FUND', 'FIRED', null],
      ]);
    });

    it('повторный вызов ничего не пишет', async () => {
      closedOrder();
      prisma.motivationAccrual.findFirst.mockResolvedValue({
        id: 'accrual-1',
      } as never);

      await service.chargeByOrder(ctx, 'order-1');

      expect(factsService.byOrder).not.toHaveBeenCalled();
      expect(prisma.motivationAccrual.createMany).not.toHaveBeenCalled();
      expect(transactions.createWithinTransaction).not.toHaveBeenCalled();
    });

    it('схемы на дату закрытия нет — премии нет', async () => {
      closedOrder();
      schemes.activeAt.mockResolvedValue(null);

      await service.chargeByOrder(ctx, 'order-1');

      expect(prisma.motivationAccrual.createMany).not.toHaveBeenCalled();
      expect(transactions.createWithinTransaction).not.toHaveBeenCalled();
    });

    it('открытый заказ не начисляется', async () => {
      prisma.order.findFirst.mockResolvedValue({
        id: 'order-1',
        number: 101,
        close: null,
      } as never);

      await service.chargeByOrder(ctx, 'order-1');

      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('гонка с параллельным начислением не роняет закрытие', async () => {
      closedOrder();
      prisma.motivationAccrual.createMany.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('unique', {
          code: 'P2002',
          clientVersion: 'test',
        }),
      );

      await expect(service.chargeByOrder(ctx, 'order-1')).resolves.toBe(
        undefined,
      );
    });
  });

  describe('orderMotivation', () => {
    it('открытый заказ: прогноз без записи, гарантия в исключённых', async () => {
      prisma.order.findFirst.mockResolvedValue({
        id: 'order-1',
        number: 101,
        close: null,
      } as never);
      profit.computeOrderRows.mockResolvedValue([]);
      factsService.byProfitRows.mockResolvedValue(facts);
      schemes.resolveAt.mockResolvedValue({ stored, scheme: stored.scheme });

      const result = await service.orderMotivation(ctx, 'order-1');

      expect(result.mode).toBe(OrderMotivationModeEnum.PREVIEW);
      expect(result.schemeVersion).toBe(3);
      expect(result.employees.map((e) => [e.employeeId, e.amount])).toEqual([
        ['emp-master', 6_000n],
        ['emp-admin', 4_000n],
      ]);
      expect(result.excluded.map((item) => item.reason)).toEqual(['WARRANTY']);
      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(prisma.motivationAccrual.createMany).not.toHaveBeenCalled();
      expect(transactions.createWithinTransaction).not.toHaveBeenCalled();
    });

    it('прогноз совпадает с начислением', async () => {
      prisma.order.findFirst.mockResolvedValue({
        id: 'order-1',
        number: 101,
        close: null,
      } as never);
      profit.computeOrderRows.mockResolvedValue([]);
      factsService.byProfitRows.mockResolvedValue(facts);
      schemes.resolveAt.mockResolvedValue({ stored, scheme: stored.scheme });
      const preview = await service.orderMotivation(ctx, 'order-1');

      closedOrder();
      await service.chargeByOrder(ctx, 'order-1');
      const data = accrualRows();
      prisma.motivationAccrual.findMany.mockResolvedValue(
        data.map((row) => ({
          ...row,
          scheme: { version: stored.version },
        })) as never,
      );
      const accrued = await service.orderMotivation(ctx, 'order-1');

      expect(accrued.mode).toBe(OrderMotivationModeEnum.ACCRUED);
      expect(accrued.employees).toEqual(preview.employees);
      expect(accrued.items).toEqual(preview.items);
      expect(accrued.excluded).toEqual(preview.excluded);
    });

    it('закрыт без начисления: расчёт по схеме на дату закрытия и повтор', async () => {
      closedOrder();
      prisma.motivationAccrual.findMany.mockResolvedValue([]);
      schemes.resolveAt.mockResolvedValue({ stored, scheme: stored.scheme });

      const result = await service.orderMotivation(ctx, 'order-1');

      expect(schemes.resolveAt).toHaveBeenCalledWith(ctx.tenantId, CLOSED_AT);
      expect(result.mode).toBe(OrderMotivationModeEnum.NOT_ACCRUED);
      expect(result.canCharge).toBe(true);
    });
  });
});
