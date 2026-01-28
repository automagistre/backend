import { Field, ID, InputType } from '@nestjs/graphql';
import { IsOptional, IsUUID, Length } from 'class-validator';

@InputType()
export class UpdateCarRecommendationInput {
  @Field(() => ID)
  @IsUUID()
  id: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @Length(1, 255)
  service?: string | null;

  @Field(() => ID, { nullable: true, description: 'ID сотрудника (employeeId)' })
  @IsOptional()
  @IsUUID()
  workerId?: string | null;

  @Field(() => Date, { nullable: true })
  @IsOptional()
  expiredAt?: Date | null;

  @Field(() => BigInt, { nullable: true })
  @IsOptional()
  priceAmount?: bigint | null;

  @Field(() => String, { nullable: true })
  @IsOptional()
  priceCurrencyCode?: string | null;
}

