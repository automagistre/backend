import { Field, ID, InputType, Int, PartialType } from '@nestjs/graphql';
import { IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';
import { CreateReviewInput } from './create-review.input';

@InputType()
export class UpdateReviewInput extends PartialType(CreateReviewInput) {
  @IsUUID()
  @Field(() => ID, { description: 'ID отзыва' })
  id: string;
}
