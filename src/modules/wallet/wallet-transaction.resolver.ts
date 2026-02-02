import {
  Args,
  Mutation,
  Parent,
  Query,
  ResolveField,
  Resolver,
} from '@nestjs/graphql';
import { WalletTransactionModel } from './models/wallet-transaction.model';
import { WalletTransactionService } from './wallet-transaction.service';
import { CreateWalletTransactionInput } from './inputs/create-wallet-transaction.input';
import { PaginationArgs } from 'src/common/pagination.args';
import { PaginatedWalletTransactions } from './types/paginated-wallet-transactions.type';

@Resolver(() => WalletTransactionModel)
export class WalletTransactionResolver {
  constructor(
    private readonly walletTransactionService: WalletTransactionService,
  ) {}

  @ResolveField(() => String)
  async sourceDisplay(
    @Parent() tx: { source: number; sourceId: string },
  ): Promise<string> {
    return this.walletTransactionService.getSourceDisplay(tx.source, tx.sourceId);
  }

  @Query(() => PaginatedWalletTransactions)
  async walletTransactions(
    @Args() pagination?: PaginationArgs,
    @Args('walletId', { nullable: true }) walletId?: string,
  ) {
    const { take = 25, skip = 0 } = pagination ?? {};
    return this.walletTransactionService.findMany({
      take,
      skip,
      walletId,
    });
  }

  @Query(() => WalletTransactionModel, { nullable: true })
  async walletTransaction(@Args('id') id: string) {
    return this.walletTransactionService.findOne(id);
  }

  @Mutation(() => WalletTransactionModel)
  async createOneWalletTransaction(
    @Args('input') input: CreateWalletTransactionInput,
  ) {
    return this.walletTransactionService.create(input);
  }
}
