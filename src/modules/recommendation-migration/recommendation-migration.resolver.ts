import { Args, Mutation, Resolver } from '@nestjs/graphql';
import { RecommendationWorkMigrationService } from './recommendation-work-migration.service';
import { RealizeCarRecommendationInput } from 'src/modules/recommendation-migration/inputs/realize-car-recommendation.input';
import { RealizeCarRecommendationPayload } from 'src/modules/recommendation-migration/models/realize-car-recommendation.payload';

@Resolver()
export class RecommendationMigrationResolver {
  constructor(
    private readonly recommendationWorkMigrationService: RecommendationWorkMigrationService,
  ) {}

  @Mutation(() => [RealizeCarRecommendationPayload], {
    name: 'realizeCarRecommendation',
    description: 'Реализовать рекомендацию в заказе',
  })
  async realizeCarRecommendation(
    @Args('input') input: RealizeCarRecommendationInput,
  ): Promise<RealizeCarRecommendationPayload[]> {
    return this.recommendationWorkMigrationService.realizeCarRecommendation(input);
  }
}
