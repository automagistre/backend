import { Field, ID, InputType, Int, PartialType } from '@nestjs/graphql';
import { CreatePartInput } from './create.input';

@InputType()
export class UpdatePartInput extends PartialType(CreatePartInput) {
  @Field(() => ID, { nullable: false, description: 'ID запчасти' })
  id: string;

  @Field(() => Int, { nullable: true, description: 'Когда на складе осталось' })
  orderFromQuantity?: number | null;

  @Field(() => Int, { nullable: true, description: 'Заказывать до' })
  orderUpToQuantity?: number | null;
}
