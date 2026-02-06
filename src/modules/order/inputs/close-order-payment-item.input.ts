import { Field, InputType } from '@nestjs/graphql';
import { IsUUID } from 'class-validator';
import { MoneyInput } from 'src/common/inputs/money.input';

/** Один платёж при закрытии заказа: счёт и сумма (order_payment не создаём). */
@InputType()
export class CloseOrderPaymentItem {
  @IsUUID()
  @Field(() => String, { description: 'ID счёта (кошелька)' })
  walletId: string;

  @Field(() => MoneyInput, {
    description: 'Сумма в минорных единицах (копейки), положительная',
  })
  amount: MoneyInput;
}
