import { Field, ID, InputType, PartialType } from '@nestjs/graphql';
import { CreateOrderItemPartInput } from './create-order-item-part.input';

@InputType()
export class UpdateOrderItemPartInput extends PartialType(CreateOrderItemPartInput) {
  @Field(() => ID)
  id: string;
}

