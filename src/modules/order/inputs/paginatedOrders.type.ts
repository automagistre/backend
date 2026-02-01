import { Field, Int, ObjectType } from '@nestjs/graphql';
import { OrderModel } from '../models/order.model';

@ObjectType()
export class PaginatedOrders {
  @Field(() => [OrderModel])
  items: OrderModel[];

  @Field(() => Int)
  total: number;
}
