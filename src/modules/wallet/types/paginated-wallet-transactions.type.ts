import { Field, Int, ObjectType } from '@nestjs/graphql';
import { WalletTransactionModel } from '../models/wallet-transaction.model';

@ObjectType()
export class PaginatedWalletTransactions {
  @Field(() => [WalletTransactionModel])
  items: WalletTransactionModel[];

  @Field(() => Int)
  total: number;
}
