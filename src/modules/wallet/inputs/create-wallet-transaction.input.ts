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

  @IsOptional()
  @IsUUID()
  @Field(() => String, {
    nullable: true,
    description:
      'ID источника (заказ, приход, статья расхода и т.д.). Опциональный — для ручных проводок без основания будет сгенерирован случайный UUID.',
  })
  sourceId?: string | null;

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
