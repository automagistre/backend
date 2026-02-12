import { Field, Int, ObjectType } from '@nestjs/graphql';
import { IncomeModel } from '../models/income.model';

@ObjectType()
export class PaginatedIncomes {
  @Field(() => [IncomeModel])
  items: IncomeModel[];

  @Field(() => Int)
  total: number;
}
