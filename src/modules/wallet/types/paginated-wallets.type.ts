import { Field, Int, ObjectType } from '@nestjs/graphql';
import { WalletModel } from '../models/wallet.model';

@ObjectType()
export class PaginatedWallets {
  @Field(() => [WalletModel])
  items: WalletModel[];

  @Field(() => Int)
  total: number;
}
