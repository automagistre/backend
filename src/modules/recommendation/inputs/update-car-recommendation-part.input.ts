import { Field, ID, InputType, Int } from '@nestjs/graphql';
import { IsOptional, IsUUID, Min } from 'class-validator';

@InputType()
export class UpdateCarRecommendationPartInput {
  @Field(() => ID)
  @IsUUID()
  id: string;

  @Field(() => Int, { nullable: true })
  @IsOptional()
  @Min(0)
  quantity?: number | null;

  @Field(() => BigInt, { nullable: true })
  @IsOptional()
  priceAmount?: bigint | null;

  @Field(() => String, { nullable: true })
  @IsOptional()
  priceCurrencyCode?: string | null;
}

