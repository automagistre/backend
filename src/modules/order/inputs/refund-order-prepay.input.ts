import { Field, InputType } from '@nestjs/graphql';
import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { MoneyInput } from 'src/common/inputs/money.input';

@InputType()
export class RefundOrderPrepayInput {
  @IsUUID()
  @Field(() => String, { description: 'ID заказа' })
  orderId: string;

  @IsUUID()
  @Field(() => String, { description: 'ID счёта, с которого выдаётся возврат' })
  walletId: string;

  @Field(() => MoneyInput, {
    description: 'Сумма возврата в минорных единицах (копейки), положительное число',
  })
  amount: MoneyInput;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  @Field(() => String, { nullable: true, description: 'Описание' })
  description?: string | null;
}
