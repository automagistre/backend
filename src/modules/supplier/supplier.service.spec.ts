import { SupplierService } from './supplier.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { createPrismaMock, type PrismaMock } from 'src/common/testing/prisma-mock';
import { makeCtx } from 'src/common/testing/auth-context';

describe('SupplierService', () => {
  let prisma: PrismaMock;
  let service: SupplierService;
  const ctx = makeCtx();

  beforeEach(() => {
    prisma = createPrismaMock();
    service = new SupplierService(prisma as unknown as PrismaService);
    prisma.income.groupBy.mockResolvedValue([] as any);
    prisma.partSupply.groupBy.mockResolvedValue([] as any);
    prisma.orderItemPart.findMany.mockResolvedValue([] as any);
    prisma.orderItemService.findMany.mockResolvedValue([] as any);
    prisma.employee.findMany.mockResolvedValue([] as any);
  });

  describe('getSuppliers', () => {
    it('сортирует по популярности: организация с проводками выше', async () => {
      prisma.person.findMany.mockResolvedValue([
        { id: 'p1', lastname: 'Борисов', firstname: 'Антон' },
      ] as any);
      prisma.organization.findMany.mockResolvedValue([
        { id: 'o1', name: 'Алмаз' },
      ] as any);
      prisma.income.groupBy.mockResolvedValue([
        { supplierId: 'o1', _count: { supplierId: 5 } },
      ] as any);

      const res = await service.getSuppliers(ctx);
      expect(res).toHaveLength(2);
      expect(res[0].id).toBe('o1');
      expect((res[0] as any)._count).toBeUndefined();
    });
  });

  describe('getContractors', () => {
    it('исключает персон-сотрудников', async () => {
      prisma.person.findMany.mockResolvedValue([
        { id: 'p1', lastname: 'A', firstname: 'A' },
        { id: 'p2', lastname: 'B', firstname: 'B' },
      ] as any);
      prisma.organization.findMany.mockResolvedValue([] as any);
      prisma.employee.findMany.mockResolvedValue([{ personId: 'p1' }] as any);

      const res = await service.getContractors(ctx);
      const ids = res.map((r) => r.id);
      expect(ids).toContain('p2');
      expect(ids).not.toContain('p1');
    });
  });
});
