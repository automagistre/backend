import { Field, InputType } from '@nestjs/graphql';
import {
  IsOptional,
  IsString,
  IsUUID,
  Length,
  MaxLength,
} from 'class-validator';

@InputType()
export class RefundOrderPrepayInput {
  @IsUUID()
  @Field(() => String, { description: 'ID заказа' })
  orderId: string;

  @IsUUID()
  @Field(() => String, { description: 'ID счёта, с которого выдаётся возврат' })
  walletId: string;

  @Field(() => BigInt, {
    description: 'Сумма возврата в минорных единицах (копейки), положительное число',
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
