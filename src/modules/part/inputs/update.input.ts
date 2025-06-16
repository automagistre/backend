import { Field, ID, InputType, PartialType } from '@nestjs/graphql';
import { CreatePartInput } from './create.input';

@InputType()
export class UpdatePartInput extends PartialType(CreatePartInput) {
  @Field(() => ID, { nullable: false, description: 'ID запчасти' })
  id: string;
}
