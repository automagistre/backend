import { Field, ID, Int, InputType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { IsNotEmpty, IsUUID, Min, ValidateNested } from 'class-validator';
import { MoneyInput } from 'src/common/inputs/money.input';

@InputType()
export class CreateIncomePartInput {
  @IsUUID()
  @Field(() => ID)
  incomeId: string;

  @IsUUID()
  @Field(() => ID)
  partId: string;

  @Min(1, { message: 'Количество должно быть не меньше 1' })
  @Field(() => Int)
  quantity: number;

  @ValidateNested()
  @Type(() => MoneyInput)
  @Field(() => MoneyInput)
  price: MoneyInput;
}
