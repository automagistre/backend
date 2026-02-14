import { Field, Int, ObjectType } from '@nestjs/graphql';
import { ReviewModel } from '../models/review.model';

@ObjectType()
export class PaginatedReviews {
  @Field(() => [ReviewModel])
  items: ReviewModel[];

  @Field(() => Int)
  total: number;
}
