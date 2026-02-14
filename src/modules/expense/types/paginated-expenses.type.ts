import { Field, Int, ObjectType } from '@nestjs/graphql';
import { ExpenseModel } from '../models/expense.model';

@ObjectType()
export class PaginatedExpenses {
  @Field(() => [ExpenseModel])
  items: ExpenseModel[];

  @Field(() => Int)
  total: number;
}
