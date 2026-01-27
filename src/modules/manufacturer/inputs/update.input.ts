import { Field, ID, InputType, PartialType } from '@nestjs/graphql';
import { CreateManufacturerInput } from './create.input';

@InputType()
export class UpdateManufacturerInput extends PartialType(
  CreateManufacturerInput,
) {
  @Field(() => ID, { description: 'ID производителя' })
  id: string;
}
