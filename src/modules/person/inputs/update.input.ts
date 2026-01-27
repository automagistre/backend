import { Field, InputType, PartialType } from '@nestjs/graphql';
import { CreatePersonInput } from './create.input';

@InputType()
export class UpdatePersonInput extends PartialType(CreatePersonInput) {
  @Field(() => String)
  id: string;
}
