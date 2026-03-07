import { Field, ID, InputType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { IsOptional, IsString, IsUUID, MaxLength, ValidateNested } from 'class-validator';
import { MoneyInput } from 'src/common/inputs/money.input';

@InputType()
export class AccrueIncomePaymentInput {
  @IsUUID()
  @Field(() => ID, { description: 'ID счета для оплаты прихода' })
  walletId: string;

  @ValidateNested()
  @Type(() => MoneyInput)
  @Field(() => MoneyInput, {
    description: 'Сумма оплаты (минорные единицы + валюта)',
  })
  amount: MoneyInput;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  @Field(() => String, {
    nullable: true,
    description: 'Комментарий к оплате',
  })
  description?: string | null;
}
