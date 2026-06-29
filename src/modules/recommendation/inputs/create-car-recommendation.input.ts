import { Field, ID, InputType } from '@nestjs/graphql';
import { IsOptional, IsUUID, Length } from 'class-validator';
import { MoneyInput } from 'src/common/inputs/money.input';
import { ExecutorInput } from 'src/common/party';

@InputType()
export class CreateCarRecommendationInput {
  @Field(() => ID)
  @IsUUID()
  carId: string;

  @Field(() => String)
  @Length(1, 255)
  service: string;

  @Field(() => ExecutorInput, {
    description: 'Диагност/исполнитель рекомендации (персона или организация)',
  })
  executor: ExecutorInput;

  @Field(() => Date, { nullable: true })
  @IsOptional()
  expiredAt?: Date | null;

  @Field(() => MoneyInput, { nullable: true })
  @IsOptional()
  price?: MoneyInput;
}
