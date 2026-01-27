import { Field, ID, Int, ObjectType } from '@nestjs/graphql';
import { OrderStatus } from '../../order/enums/order-status.enum';

@ObjectType({ description: 'Источник резерва по запчасти (для сценария "занять")' })
export class PartReservationSourceModel {
  @Field(() => ID)
  orderId: string;

  @Field(() => Int)
  orderNumber: number;

  @Field(() => OrderStatus)
  orderStatus: OrderStatus;

  @Field(() => ID)
  orderItemPartId: string;

  @Field(() => Int)
  reservedQuantity: number;
}

