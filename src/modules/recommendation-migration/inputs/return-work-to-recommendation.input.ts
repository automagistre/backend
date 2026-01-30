import { Field, ID, InputType } from '@nestjs/graphql';
import { IsUUID } from 'class-validator';

@InputType()
export class ReturnWorkToRecommendationInput {
  @Field(() => ID)
  @IsUUID()
  orderItemServiceId: string;
}
