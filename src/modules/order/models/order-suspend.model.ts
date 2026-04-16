import { Field, ID, ObjectType } from '@nestjs/graphql';

@ObjectType({ description: 'Запись о приостановке заказа' })
export class OrderSuspendModel {
  @Field(() => ID)
  id: string;

  @Field(() => ID)
  orderId: string;

  @Field(() => Date, { description: 'Дата, до которой заказ в сне' })
  till: Date;

  @Field(() => String, { description: 'Причина приостановки' })
  reason: string;

  @Field(() => Date, { nullable: true })
  createdAt: Date | null;

  @Field(() => ID, { nullable: true })
  createdBy: string | null;
}
