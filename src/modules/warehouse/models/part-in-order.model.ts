import { Field, ID, Int, ObjectType } from '@nestjs/graphql';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';
import { OrderStatus } from '../../order/enums/order-status.enum';

@ObjectType({ description: 'Заказ, содержащий запчасть (для панели информации)' })
export class PartInOrderModel {
  @IsUUID()
  @Field(() => ID)
  orderId: string;

  @IsInt()
  @Min(1)
  @Field(() => Int)
  orderNumber: number;

  @IsEnum(OrderStatus)
  @Field(() => OrderStatus)
  orderStatus: OrderStatus;

  @IsInt()
  @Min(0)
  @Field(() => Int)
  quantity: number;

  @IsInt()
  @Min(0)
  @Field(() => Int)
  reservedQuantity: number;

  @IsOptional()
  @IsString()
  @Field(() => String, { nullable: true })
  customerName?: string | null;

  @IsOptional()
  @IsString()
  @Field(() => String, { nullable: true })
  carName?: string | null;
}
