import { Field, ID, InputType } from '@nestjs/graphql';
import { IsOptional, IsUUID, Length } from 'class-validator';
import { MoneyInput } from 'src/common/inputs/money.input';

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

  @Field(() => MoneyInput, { nullable: true })
  @IsOptional()
  price?: MoneyInput;
}

