import { Field, InputType } from '@nestjs/graphql';
import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { MoneyInput } from 'src/common/inputs/money.input';

@InputType()
export class CreateOrderPrepayInput {
  @IsUUID()
  @Field(() => String, { description: 'ID заказа' })
  orderId: string;

  @IsUUID()
  @Field(() => String, { description: 'ID счёта' })
  walletId: string;

  @Field(() => MoneyInput, {
    description: 'Сумма в минорных единицах (копейки)',
  })
  amount: MoneyInput;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  @Field(() => String, { nullable: true, description: 'Описание' })
  description?: string | null;
}
