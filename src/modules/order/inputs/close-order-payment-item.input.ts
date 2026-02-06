import { Field, InputType } from '@nestjs/graphql';
import { IsUUID } from 'class-validator';

/** Один платёж при закрытии заказа: счёт и сумма (order_payment не создаём). */
@InputType()
export class CloseOrderPaymentItem {
  @IsUUID()
  @Field(() => String, { description: 'ID счёта (кошелька)' })
  walletId: string;

  @Field(() => BigInt, {
    description: 'Сумма в минорных единицах (копейки), положительная',
  })
  amountAmount: bigint;
}
