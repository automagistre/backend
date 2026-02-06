import { Field, ID, InputType, Int } from '@nestjs/graphql';
import {
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { MoneyInput } from 'src/common/inputs/money.input';

@InputType()
export class CreateWalletTransactionInput {
  @IsUUID()
  @Field(() => ID, { description: 'ID кошелька' })
  walletId: string;

  @IsInt()
  @Field(() => Int, { description: 'Источник проводки (enum)' })
  source: number;

  @IsUUID()
  @Field(() => String, { description: 'ID источника (заказ, приход и т.д.)' })
  sourceId: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  @Field(() => String, { nullable: true, description: 'Описание' })
  description?: string | null;

  @Field(() => MoneyInput, {
    description: 'Сумма (минорные единицы + валюта)',
  })
  amount: MoneyInput;
}
