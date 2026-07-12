import { PrismaService } from 'src/prisma/prisma.service';
import { createPrismaMock, type PrismaMock } from 'src/common/testing/prisma-mock';
import { CogsService } from './cogs.service';

describe('CogsService', () => {
  let prisma: PrismaMock;
  let service: CogsService;

  beforeEach(() => {
    prisma = createPrismaMock();
    service = new CogsService(prisma as unknown as PrismaService);
  });

  describe('getPartUnitCogsAtDate', () => {
    it('возвращает цену последней закупки не позднее atDate', async () => {
      (prisma.$queryRawUnsafe as jest.Mock).mockResolvedValue([
        { unit_cost: 3000n },
      ]);

      const result = await service.getPartUnitCogsAtDate(
        'tenant-1',
        'part-1',
        new Date('2026-01-01'),
      );

      expect(result).toBe(3000n);
    });

    it('возвращает null, если закупок не было', async () => {
      (prisma.$queryRawUnsafe as jest.Mock).mockResolvedValue([]);

      const result = await service.getPartUnitCogsAtDate(
        'tenant-1',
        'part-1',
        new Date('2026-01-01'),
      );

      expect(result).toBeNull();
    });
  });

  describe('getPartLineCogsAtDate', () => {
    it('умножает unit cost на quantity (÷100, т.к. quantity хранится ×100)', async () => {
      (prisma.$queryRawUnsafe as jest.Mock).mockResolvedValue([
        { unit_cost: 3000n },
      ]);

      // quantity=200 в БД (×100) означает 2 шт → 2 × 3000 = 6000
      const result = await service.getPartLineCogsAtDate(
        'tenant-1',
        'part-1',
        200,
        new Date('2026-01-01'),
      );

      expect(result).toBe(6000n);
    });

    it('возвращает 0n, если закупок не было', async () => {
      (prisma.$queryRawUnsafe as jest.Mock).mockResolvedValue([]);

      const result = await service.getPartLineCogsAtDate(
        'tenant-1',
        'part-1',
        100,
        new Date('2026-01-01'),
      );

      expect(result).toBe(0n);
    });
  });

  describe('unitCogsLateralJoinSql', () => {
    it('строит корректный SQL-фрагмент со ссылками на переданные выражения', () => {
      const sql = CogsService.unitCogsLateralJoinSql(
        'oip.part_id',
        'o.tenant_id',
        'od.created_at',
      );

      expect(sql).toContain('ip.part_id = oip.part_id');
      expect(sql).toContain('ip.tenant_id = o.tenant_id');
      expect(sql).toContain('i.created_at <= od.created_at');
      expect(sql).toContain('LEFT JOIN LATERAL');
    });
  });
});
