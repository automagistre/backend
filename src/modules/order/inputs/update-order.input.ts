import { Field, ID, InputType, Int } from '@nestjs/graphql';
import { OrderStatus } from '../enums/order-status.enum';

@InputType()
export class UpdateOrderInput {
  @Field(() => ID)
  id: string;

  @Field(() => ID, { nullable: true })
  carId?: string | null;

  @Field(() => ID, { nullable: true })
  customerId?: string | null;

  @Field(() => ID, { nullable: true })
  workerId?: string | null;

  @Field(() => Int, { nullable: true })
  mileage?: number | null;

  @Field(() => OrderStatus, { nullable: true })
  status?: OrderStatus | null;
}
