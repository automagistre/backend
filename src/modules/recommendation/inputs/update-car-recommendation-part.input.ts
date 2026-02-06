import { Field, ID, InputType, Int } from '@nestjs/graphql';
import { IsOptional, IsUUID, Min } from 'class-validator';
import { MoneyInput } from 'src/common/inputs/money.input';

@InputType()
export class UpdateCarRecommendationPartInput {
  @Field(() => ID)
  @IsUUID()
  id: string;

  @Field(() => Int, { nullable: true })
  @IsOptional()
  @Min(0)
  quantity?: number | null;

  @Field(() => MoneyInput, { nullable: true })
  @IsOptional()
  price?: MoneyInput;
}

