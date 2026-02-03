import { Field, InputType, Int } from '@nestjs/graphql';
import {
  IsOptional,
  IsString,
  IsUUID,
  Length,
  MaxLength,
} from 'class-validator';

@InputType()
export class CreateOrderPrepayInput {
  @IsUUID()
  @Field(() => String, { description: 'ID заказа' })
  orderId: string;

  @IsUUID()
  @Field(() => String, { description: 'ID счёта' })
  walletId: string;

  @Field(() => BigInt, {
    description: 'Сумма в минорных единицах (копейки)',
  })
  amountAmount: bigint;

  @IsOptional()
  @IsString()
  @Length(3, 3)
  @Field(() => String, {
    nullable: true,
    description: 'Код валюты (например RUB)',
  })
  amountCurrencyCode?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  @Field(() => String, { nullable: true, description: 'Описание' })
  description?: string | null;
}
