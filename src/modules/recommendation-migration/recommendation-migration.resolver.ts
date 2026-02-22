import { Args, Mutation, Resolver } from '@nestjs/graphql';
import { RecommendationWorkMigrationService } from './recommendation-work-migration.service';
import { RealizeCarRecommendationInput } from 'src/modules/recommendation-migration/inputs/realize-car-recommendation.input';
import { RealizeCarRecommendationPayload } from 'src/modules/recommendation-migration/models/realize-car-recommendation.payload';
import { ReturnWorkToRecommendationInput } from 'src/modules/recommendation-migration/inputs/return-work-to-recommendation.input';
import { ReturnWorkToRecommendationPayload } from 'src/modules/recommendation-migration/models/return-work-to-recommendation.payload';
import { AuthContext } from 'src/common/decorators/auth-context.decorator';
import { RequireTenant } from 'src/common/decorators/skip-tenant.decorator';
import type { AuthContext as AuthContextType } from 'src/common/user-id.store';

@Resolver()
@RequireTenant()
export class RecommendationMigrationResolver {
  constructor(
    private readonly recommendationWorkMigrationService: RecommendationWorkMigrationService,
  ) {}

  @Mutation(() => [RealizeCarRecommendationPayload], {
    name: 'realizeCarRecommendation',
    description: 'Реализовать рекомендацию в заказе',
  })
  async realizeCarRecommendation(
    @AuthContext() ctx: AuthContextType,
    @Args('input') input: RealizeCarRecommendationInput,
  ): Promise<RealizeCarRecommendationPayload[]> {
    return this.recommendationWorkMigrationService.realizeCarRecommendation(ctx, input);
  }

  @Mutation(() => ReturnWorkToRecommendationPayload, {
    name: 'returnWorkToRecommendation',
    description: 'Вернуть работу в рекомендацию',
  })
  async returnWorkToRecommendation(
    @AuthContext() ctx: AuthContextType,
    @Args('input') input: ReturnWorkToRecommendationInput,
  ): Promise<ReturnWorkToRecommendationPayload> {
    return this.recommendationWorkMigrationService.returnWorkToRecommendation(ctx, input);
  }
}
