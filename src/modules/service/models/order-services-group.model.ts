import { Field, ID, Int, ObjectType } from '@nestjs/graphql';
import { OrderStatus } from '../../order/enums/order-status.enum';
import { CarServiceHistoryItemModel } from './car-service-history-item.model';

@ObjectType()
export class OrderServicesGroupModel {
  @Field(() => ID)
  orderId: string;

  @Field(() => Int)
  orderNumber: number;

  @Field(() => OrderStatus)
  orderStatus: OrderStatus;

  @Field(() => Int, { nullable: true })
  orderMileage: number | null;

  @Field(() => String, { nullable: true })
  orderDate: string | null;

  @Field(() => [CarServiceHistoryItemModel])
  services: CarServiceHistoryItemModel[];
}
