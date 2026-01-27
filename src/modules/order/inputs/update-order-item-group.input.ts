import { Field, ID, InputType, PartialType } from '@nestjs/graphql';
import { CreateOrderItemGroupInput } from './create-order-item-group.input';

@InputType()
export class UpdateOrderItemGroupInput extends PartialType(
  CreateOrderItemGroupInput,
) {
  @Field(() => ID)
  id: string;
}
