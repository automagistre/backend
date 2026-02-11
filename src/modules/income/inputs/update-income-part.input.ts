import { Field, ID, InputType, PartialType } from '@nestjs/graphql';
import { CreateIncomePartInput } from './create-income-part.input';
import { IsUUID } from 'class-validator';

@InputType()
export class UpdateIncomePartInput extends PartialType(CreateIncomePartInput) {
  @IsUUID()
  @Field(() => ID)
  id: string;
}
