import { Field, ID, InputType } from '@nestjs/graphql';
import { IsOptional, IsUUID, Length } from 'class-validator';
import { MoneyInput } from 'src/common/inputs/money.input';
import { ExecutorInput } from 'src/common/party';

@InputType()
export class UpdateCarRecommendationInput {
  @Field(() => ID)
  @IsUUID()
  id: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @Length(1, 255)
  service?: string | null;

  @Field(() => ExecutorInput, { nullable: true })
  @IsOptional()
  executor?: ExecutorInput | null;

  @Field(() => Date, { nullable: true })
  @IsOptional()
  expiredAt?: Date | null;

  @Field(() => MoneyInput, { nullable: true })
  @IsOptional()
  price?: MoneyInput;
}
