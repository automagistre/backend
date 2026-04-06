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
import { RequireTenant } from 'src/common/decorators/skip-tenant.decorator';
import { AuthContext as AuthContextDecorator } from 'src/common/decorators/auth-context.decorator';
import type { AuthContext as AuthContextType } from 'src/common/user-id.store';
import { AppUserModel } from '../app-user/models/app-user.model';
import { AppUserLoader } from '../app-user/app-user.loader';

@Resolver(() => WalletTransactionModel)
export class WalletTransactionResolver {
  constructor(
    private readonly walletTransactionService: WalletTransactionService,
    private readonly appUserLoader: AppUserLoader,
  ) {}

  @RequireTenant()
  @ResolveField(() => String)
  async sourceDisplay(
    @AuthContextDecorator() ctx: AuthContextType,
    @Parent() tx: { source: number; sourceId: string },
  ): Promise<string> {
    return this.walletTransactionService.getSourceDisplay(
      ctx,
      tx.source,
      tx.sourceId,
    );
  }

  @RequireTenant()
  @Query(() => PaginatedWalletTransactions)
  async walletTransactions(
    @AuthContextDecorator() ctx: AuthContextType,
    @Args() pagination?: PaginationArgs,
    @Args('walletId', { nullable: true }) walletId?: string,
  ) {
    const { take = 25, skip = 0 } = pagination ?? {};
    return this.walletTransactionService.findMany(ctx, {
      take,
      skip,
      walletId,
    });
  }

  @RequireTenant()
  @Query(() => WalletTransactionModel, { nullable: true })
  async walletTransaction(
    @AuthContextDecorator() ctx: AuthContextType,
    @Args('id') id: string,
  ) {
    return this.walletTransactionService.findOneTransaction(ctx, id);
  }

  @RequireTenant()
  @Mutation(() => WalletTransactionModel)
  async createOneWalletTransaction(
    @AuthContextDecorator() ctx: AuthContextType,
    @Args('input') input: CreateWalletTransactionInput,
  ) {
    return this.walletTransactionService.create(ctx, input);
  }

  @ResolveField(() => AppUserModel, { nullable: true })
  async createdByUser(@Parent() tx: WalletTransactionModel) {
    if (!tx.createdBy) return null;
    return this.appUserLoader.load(tx.createdBy);
  }
}
