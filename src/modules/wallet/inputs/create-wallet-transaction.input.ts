import { Field, ID, InputType, Int } from '@nestjs/graphql';
import {
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  MaxLength,
} from 'class-validator';

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

  @IsOptional()
  @Field(() => BigInt, {
    nullable: true,
    description: 'Сумма в минорных единицах (копейки)',
  })
  amountAmount?: bigint | null;

  @IsOptional()
  @IsString()
  @Length(3, 3)
  @Field(() => String, { nullable: true, description: 'Код валюты' })
  amountCurrencyCode?: string | null;
}
