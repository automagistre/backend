import { Field, ID, InputType, Int } from '@nestjs/graphql';
import { IsOptional, IsUUID, Min } from 'class-validator';
import { MoneyInput } from 'src/common/inputs/money.input';

@InputType()
export class CreateCarRecommendationPartInput {
  @Field(() => ID)
  @IsUUID()
  recommendationId: string;

  @Field(() => ID)
  @IsUUID()
  partId: string;

  @Field(() => Int)
  @Min(0)
  quantity: number;

  @Field(() => MoneyInput, { nullable: true })
  @IsOptional()
  price?: MoneyInput;
}

