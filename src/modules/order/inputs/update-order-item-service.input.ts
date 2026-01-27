import { Field, ID, InputType, PartialType } from '@nestjs/graphql';
import { CreateOrderItemServiceInput } from './create-order-item-service.input';

@InputType()
export class UpdateOrderItemServiceInput extends PartialType(
  CreateOrderItemServiceInput,
) {
  @Field(() => ID)
  id: string;
}
