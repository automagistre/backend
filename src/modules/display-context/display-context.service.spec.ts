import { DisplayContextService } from './display-context.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { createPrismaMock, type PrismaMock } from 'src/common/testing/prisma-mock';
import { makeCtx } from 'src/common/testing/auth-context';

describe('DisplayContextService', () => {
  let prisma: PrismaMock;
  let service: DisplayContextService;
  const ctx = makeCtx();

  beforeEach(() => {
    prisma = createPrismaMock();
    service = new DisplayContextService(prisma as unknown as PrismaService);
  });

  describe('resolveCounterparty', () => {
    it('null при отсутствии kind или id', async () => {
      expect(await service.resolveCounterparty(null, 'id')).toBeNull();
      expect(await service.resolveCounterparty('PERSON', null)).toBeNull();
      expect(prisma.person.findUnique).not.toHaveBeenCalled();
    });

    it('ORGANIZATION → organization.findUnique', async () => {
      prisma.organization.findUnique.mockResolvedValue({ id: 'o1' } as any);
      const res = await service.resolveCounterparty('ORGANIZATION', 'o1');
      expect(prisma.organization.findUnique).toHaveBeenCalledWith({
        where: { id: 'o1' },
      });
      expect(res).toEqual({ id: 'o1' });
    });

    it('PERSON (и прочее) → person.findUnique', async () => {
      prisma.person.findUnique.mockResolvedValue({ id: 'p1' } as any);
      await service.resolveCounterparty('PERSON', 'p1');
      expect(prisma.person.findUnique).toHaveBeenCalledWith({
        where: { id: 'p1' },
      });
    });
  });

  describe('getPartyDisplay', () => {
    it('ORGANIZATION → название организации', async () => {
      prisma.organization.findUnique.mockResolvedValue({ name: 'ООО Ромашка' } as any);
      expect(await service.getPartyDisplay('ORGANIZATION', 'o1')).toBe(
        'ООО Ромашка',
      );
    });

    it('PERSON → ФИО', async () => {
      prisma.person.findUnique.mockResolvedValue({
        lastname: 'Иванов',
        firstname: 'Иван',
      } as any);
      expect(await service.getPartyDisplay('PERSON', 'p1')).toBe('Иванов Иван');
    });
  });

  describe('getOperandDisplayName', () => {
    it('персона → ФИО', async () => {
      prisma.person.findUnique.mockResolvedValue({
        lastname: 'Петров',
        firstname: 'Пётр',
      } as any);
      expect(await service.getOperandDisplayName('id')).toBe('Петров Пётр');
    });

    it('не персона → название организации', async () => {
      prisma.person.findUnique.mockResolvedValue(null);
      prisma.organization.findUnique.mockResolvedValue({ name: 'Орг' } as any);
      expect(await service.getOperandDisplayName('id')).toBe('Орг');
    });

    it('ничего не найдено → null', async () => {
      prisma.person.findUnique.mockResolvedValue(null);
      prisma.organization.findUnique.mockResolvedValue(null);
      expect(await service.getOperandDisplayName('id')).toBeNull();
    });
  });

  describe('getOrderContext', () => {
    it('«№N, ФИО» для клиента-персоны', async () => {
      prisma.order.findFirst.mockResolvedValue({
        number: 123,
        customerId: 'p1',
        customer: { lastname: 'Иванов', firstname: 'Иван' },
      } as any);
      expect(await service.getOrderContext(ctx, 'o1')).toBe('№123, Иванов Иван');
    });

    it('«№N, Организация», если клиент — организация', async () => {
      prisma.order.findFirst.mockResolvedValue({
        number: 7,
        customerId: 'org1',
        customer: null,
      } as any);
      prisma.organization.findUnique.mockResolvedValue({ name: 'Орг' } as any);
      expect(await service.getOrderContext(ctx, 'o1')).toBe('№7, Орг');
    });

    it('пустая строка, если заказ не найден', async () => {
      prisma.order.findFirst.mockResolvedValue(null);
      expect(await service.getOrderContext(ctx, 'o1')).toBe('');
    });
  });

  describe('getOrderContextByOrderItemId', () => {
    it('резолвит orderId позиции и возвращает контекст заказа', async () => {
      prisma.orderItem.findFirst.mockResolvedValue({ orderId: 'o1' } as any);
      prisma.order.findFirst.mockResolvedValue({
        number: 5,
        customerId: 'p1',
        customer: { lastname: 'Сидоров', firstname: 'Пётр' },
      } as any);

      const result = await service.getOrderContextByOrderItemId(ctx, 'item-1');

      expect(prisma.orderItem.findFirst).toHaveBeenCalledWith({
        where: { id: 'item-1', tenantId: ctx.tenantId },
        select: { orderId: true },
      });
      expect(result).toBe('№5, Сидоров Пётр');
    });

    it('пустая строка, если позиция не найдена', async () => {
      prisma.orderItem.findFirst.mockResolvedValue(null);
      expect(await service.getOrderContextByOrderItemId(ctx, 'item-x')).toBe(
        '',
      );
    });
  });

  describe('getPersonDisplay', () => {
    it('ФИО или пустая строка', async () => {
      prisma.person.findUnique.mockResolvedValue({
        lastname: 'Сидоров',
        firstname: null,
      } as any);
      expect(await service.getPersonDisplay('p1')).toBe('Сидоров');

      prisma.person.findUnique.mockResolvedValue(null);
      expect(await service.getPersonDisplay('p2')).toBe('');
    });
  });
});
