import { Field, ID, InputType } from '@nestjs/graphql';
import { ArrayMinSize, IsUUID } from 'class-validator';

@InputType()
export class RealizeCarRecommendationItemInput {
  @Field(() => ID)
  @IsUUID()
  recommendationId: string;

  @Field(() => [ID])
  @IsUUID('all', { each: true })
  partIds: string[];
}

@InputType()
export class RealizeCarRecommendationInput {
  @Field(() => [RealizeCarRecommendationItemInput])
  @ArrayMinSize(1)
  recommendations: RealizeCarRecommendationItemInput[];

  @Field(() => ID)
  @IsUUID()
  orderId: string;
}
