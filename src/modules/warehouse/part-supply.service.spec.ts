import { BadRequestException } from '@nestjs/common';
import { PartSupplyService } from './part-supply.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { SupplySource } from 'src/modules/part/enums/supply-source.enum';
import { createPrismaMock, type PrismaMock } from 'src/common/testing/prisma-mock';
import { makeCtx } from 'src/common/testing/auth-context';

describe('PartSupplyService', () => {
  let prisma: PrismaMock;
  let service: PartSupplyService;
  const ctx = makeCtx();

  beforeEach(() => {
    prisma = createPrismaMock();
    service = new PartSupplyService(prisma as unknown as PrismaService);
  });

  describe('getSupplyTotalByPart', () => {
    it('возвращает сумму, если > 0', async () => {
      prisma.partSupply.aggregate.mockResolvedValue({ _sum: { quantity: 5 } } as any);
      expect(await service.getSupplyTotalByPart('p1', 't1')).toBe(5);
    });

    it('возвращает 0 при отрицательном балансе', async () => {
      prisma.partSupply.aggregate.mockResolvedValue({ _sum: { quantity: -3 } } as any);
      expect(await service.getSupplyTotalByPart('p1', 't1')).toBe(0);
    });
  });

  describe('getPartIdsWithDelayedSupply', () => {
    it('пустой результат при пустом списке или нулевом expiry', async () => {
      expect((await service.getPartIdsWithDelayedSupply([], 5, 't1')).size).toBe(0);
      expect((await service.getPartIdsWithDelayedSupply(['p1'], 0, 't1')).size).toBe(0);
    });

    it('помечает запчасти с просроченной поставкой', async () => {
      const old = new Date('2000-01-01');
      prisma.partSupply.groupBy.mockResolvedValue([
        { partId: 'p1', supplierId: 's1', _sum: { quantity: 2 }, _max: { createdAt: old } },
        { partId: 'p2', supplierId: 's1', _sum: { quantity: 2 }, _max: { createdAt: new Date() } },
      ] as any);
      const res = await service.getPartIdsWithDelayedSupply(['p1', 'p2'], 5, 't1');
      expect(res.has('p1')).toBe(true);
      expect(res.has('p2')).toBe(false);
    });
  });

  describe('decreaseSupplyForIncome', () => {
    it('не создаёт запись при количестве <= 0', async () => {
      await service.decreaseSupplyForIncome(prisma as any, 'p1', 's1', 0, 'i1', 't1');
      expect(prisma.partSupply.create).not.toHaveBeenCalled();
    });

    it('уменьшает только в пределах положительного баланса', async () => {
      prisma.partSupply.aggregate.mockResolvedValue({ _sum: { quantity: 3 } } as any);
      await service.decreaseSupplyForIncome(prisma as any, 'p1', 's1', 10, 'i1', 't1');
      const arg = prisma.partSupply.create.mock.calls[0][0].data as any;
      expect(arg.quantity).toBe(-3);
      expect(arg.source).toBe(SupplySource.INCOME);
    });

    it('не создаёт запись при нулевом балансе', async () => {
      prisma.partSupply.aggregate.mockResolvedValue({ _sum: { quantity: 0 } } as any);
      await service.decreaseSupplyForIncome(prisma as any, 'p1', 's1', 10, 'i1', 't1');
      expect(prisma.partSupply.create).not.toHaveBeenCalled();
    });
  });

  describe('createPartSupply / cancelPartSupply', () => {
    it('createPartSupply бросает BadRequest при qty <= 0', async () => {
      await expect(
        service.createPartSupply(ctx, 'p1', 's1', 0),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('createPartSupply создаёт MANUAL поставку с положительным количеством', async () => {
      prisma.partSupply.create.mockResolvedValue({
        id: 'ps1',
        partId: 'p1',
        supplierId: 's1',
        quantity: 4,
      } as any);
      const res = await service.createPartSupply(ctx, 'p1', 's1', 4);
      expect(res.quantity).toBe(4);
      const arg = prisma.partSupply.create.mock.calls[0][0].data as any;
      expect(arg.source).toBe(SupplySource.MANUAL);
    });

    it('cancelPartSupply пишет отрицательное количество', async () => {
      prisma.partSupply.create.mockResolvedValue({ id: 'ps1' } as any);
      await service.cancelPartSupply(ctx, 'p1', 's1', 4);
      const arg = prisma.partSupply.create.mock.calls[0][0].data as any;
      expect(arg.quantity).toBe(-4);
    });
  });
});
