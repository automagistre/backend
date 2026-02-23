import { Field, ID, ObjectType } from '@nestjs/graphql';

@ObjectType({ description: 'Источник движения: заказ' })
export class OrderSourceModel {
  @Field(() => ID)
  orderId: string;

  @Field(() => Number, { description: 'Номер заказа' })
  orderNumber: number;

  @Field(() => String, { nullable: true, description: 'Название машины' })
  carName?: string | null;
}
