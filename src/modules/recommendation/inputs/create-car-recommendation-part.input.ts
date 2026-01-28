import { Field, ID, InputType, Int } from '@nestjs/graphql';
import { IsOptional, IsUUID, Min } from 'class-validator';

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

  @Field(() => BigInt, { nullable: true })
  @IsOptional()
  priceAmount?: bigint | null;

  @Field(() => String, { nullable: true })
  @IsOptional()
  priceCurrencyCode?: string | null;
}

