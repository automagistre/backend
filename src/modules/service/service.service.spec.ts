import { mockDeep, type DeepMockProxy } from 'jest-mock-extended';
import { ServiceService } from './service.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { DisplayContextService } from 'src/modules/display-context/display-context.service';
import { RecommendationService } from 'src/modules/recommendation/recommendation.service';
import { createPrismaMock, type PrismaMock } from 'src/common/testing/prisma-mock';
import { makeCtx } from 'src/common/testing/auth-context';

describe('ServiceService', () => {
  let prisma: PrismaMock;
  let recommendation: DeepMockProxy<RecommendationService>;
  let service: ServiceService;
  const ctx = makeCtx();

  beforeEach(() => {
    prisma = createPrismaMock();
    recommendation = mockDeep<RecommendationService>();
    service = new ServiceService(
      prisma as unknown as PrismaService,
      mockDeep<DisplayContextService>() as unknown as DisplayContextService,
      recommendation as unknown as RecommendationService,
    );
  });

  describe('searchServices', () => {
    it('добавляет isContractor из whitelist рекомендаций', async () => {
      jest.mocked(prisma.orderItemService.groupBy).mockResolvedValue([
        { service: 'Ремонт рулевой рейки', _count: { service: 10 } },
        { service: 'Замена масла', _count: { service: 5 } },
      ] as any);
      recommendation.getContractorFlagsForNames.mockResolvedValue(
        new Map([
          ['Ремонт рулевой рейки', true],
          ['Замена масла', false],
        ]),
      );

      const result = await service.searchServices(ctx, 'ремонт');

      expect(result).toEqual([
        { name: 'Ремонт рулевой рейки', isContractor: true },
        { name: 'Замена масла', isContractor: false },
      ]);
    });
  });

  describe('getPopularServices', () => {
    it('добавляет isContractor к популярным работам', async () => {
      jest.mocked(prisma.orderItemService.groupBy).mockResolvedValue([
        { service: 'Ремонт карданного вала', _count: { service: 3 } },
      ] as any);
      recommendation.getContractorFlagsForNames.mockResolvedValue(
        new Map([['Ремонт карданного вала', true]]),
      );

      const result = await service.getPopularServices(ctx, 20);

      expect(result).toEqual([
        { name: 'Ремонт карданного вала', isContractor: true },
      ]);
    });
  });
});
