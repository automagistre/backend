import { Field, ID, InputType, PartialType } from '@nestjs/graphql';
import { IsUUID } from 'class-validator';
import { CreateExpenseInput } from './create-expense.input';

@InputType()
export class UpdateExpenseInput extends PartialType(CreateExpenseInput) {
  @IsUUID()
  @Field(() => ID, { description: 'ID статьи расходов' })
  id: string;
}
