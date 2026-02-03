import { Field, ID, ObjectType } from '@nestjs/graphql';

@ObjectType({ description: 'Предоплата по заказу (order_payment)' })
export class OrderPaymentModel {
  @Field(() => ID)
  id: string;

  @Field(() => String)
  orderId: string;

  @Field(() => String, { nullable: true })
  description: string | null;

  @Field(() => BigInt, {
    nullable: true,
    description: 'Сумма в минорных единицах (копейки)',
  })
  amountAmount: bigint | null;

  @Field(() => String, { nullable: true })
  amountCurrencyCode: string | null;

  @Field(() => Date, { nullable: true })
  createdAt: Date | null;

  @Field(() => ID, { nullable: true })
  createdBy: string | null;
}
