import { mockDeep, type DeepMockProxy } from 'jest-mock-extended';
import { BadRequestException } from '@nestjs/common';
import { ReservationService } from './reservation.service';
import { OrderService } from '../order/order.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { AuditLogService } from 'src/modules/audit-log/audit-log.service';
import { AuditAction } from 'src/modules/audit-log/enums/audit.enums';
import { createPrismaMock, type PrismaMock } from 'src/common/testing/prisma-mock';
import { makeCtx } from 'src/common/testing/auth-context';

describe('ReservationService', () => {
  let prisma: PrismaMock;
  let orderService: DeepMockProxy<OrderService>;
  let audit: DeepMockProxy<AuditLogService>;
  let service: ReservationService;
  const ctx = makeCtx();

  beforeEach(() => {
    prisma = createPrismaMock();
    orderService = mockDeep<OrderService>();
    audit = mockDeep<AuditLogService>();
    orderService.validateOrderEditable.mockResolvedValue(undefined as any);

    service = new ReservationService(
      prisma as unknown as PrismaService,
      orderService as unknown as OrderService,
      audit as unknown as AuditLogService,
    );
  });

  describe('getReservable', () => {
    it('остаток минус резерв в активных заказах', async () => {
      prisma.motion.aggregate.mockResolvedValue({
        _sum: { quantity: 10 },
      } as any);
      prisma.reservation.aggregate.mockResolvedValue({
        _sum: { quantity: 3 },
      } as any);

      expect(await service.getReservable('p1', ctx.tenantId)).toBe(7);
    });
  });

  describe('reserve', () => {
    const stub = () => {
      prisma.orderItemPart.findUnique.mockResolvedValue({
        partId: 'p1',
        part: { name: 'Колодки' },
        orderItem: { orderId: 'o1' },
      } as any);
    };

    it('бросает при quantity <= 0', async () => {
      stub();
      await expect(
        service.reserve(ctx, { orderItemPartId: 'oip1', quantity: 0 }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('бросает, если недостаточно доступного остатка', async () => {
      stub();
      prisma.motion.aggregate.mockResolvedValue({ _sum: { quantity: 10 } } as any);
      prisma.reservation.aggregate.mockResolvedValue({
        _sum: { quantity: 8 },
      } as any);

      await expect(
        service.reserve(ctx, { orderItemPartId: 'oip1', quantity: 5 }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('создаёт резерв и пишет аудит RESERVE при достатке', async () => {
      stub();
      prisma.motion.aggregate.mockResolvedValue({ _sum: { quantity: 10 } } as any);
      prisma.reservation.aggregate.mockResolvedValue({
        _sum: { quantity: 3 },
      } as any);
      prisma.reservation.create.mockResolvedValue({ id: 'r1' } as any);

      await service.reserve(ctx, { orderItemPartId: 'oip1', quantity: 5 });

      expect(prisma.reservation.create).toHaveBeenCalledTimes(1);
      expect(audit.record).toHaveBeenCalledTimes(1);
      expect(audit.record.mock.calls[0][2].action).toBe(AuditAction.RESERVE);
    });
  });

  describe('release (частичное, FIFO)', () => {
    it('удаляет старые резервы и урезает последний', async () => {
      prisma.orderItemPart.findUnique.mockResolvedValue({
        orderItem: { orderId: 'o1' },
        part: { name: 'Колодки' },
      } as any);
      prisma.reservation.findMany.mockResolvedValue([
        { id: 'a', quantity: 3 },
        { id: 'b', quantity: 4 },
      ] as any);
      prisma.reservation.deleteMany.mockResolvedValue({ count: 1 } as any);

      const released = await service.release(ctx, {
        orderItemPartId: 'oip1',
        quantity: 5,
      });

      expect(released).toBe(5);
      expect(prisma.reservation.deleteMany).toHaveBeenCalledWith({
        where: { id: { in: ['a'] } },
      });
      expect(prisma.reservation.update).toHaveBeenCalledWith({
        where: { id: 'b' },
        data: { quantity: 2 },
      });
    });
  });
});
