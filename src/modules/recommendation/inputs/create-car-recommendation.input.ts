import { Field, ID, InputType } from '@nestjs/graphql';
import { IsOptional, IsUUID, Length } from 'class-validator';

@InputType()
export class CreateCarRecommendationInput {
  @Field(() => ID)
  @IsUUID()
  carId: string;

  @Field(() => String)
  @Length(1, 255)
  service: string;

  @Field(() => ID, {
    description: 'ID сотрудника (employeeId) — диагност/исполнитель рекомендации',
  })
  @IsUUID()
  workerId: string;

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

