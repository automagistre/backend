import { Field, Int, ObjectType } from '@nestjs/graphql';
import { CustomerTransactionModel } from '../models/customer-transaction.model';

@ObjectType()
export class PaginatedCustomerTransactions {
  @Field(() => [CustomerTransactionModel])
  items: CustomerTransactionModel[];

  @Field(() => Int)
  total: number;
}
