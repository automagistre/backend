import { Field, ID, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class RealizeCarRecommendationPayload {
  @Field(() => ID)
  orderId: string;

  @Field(() => ID)
  orderItemServiceId: string;

  @Field(() => ID)
  recommendationId: string;
}
