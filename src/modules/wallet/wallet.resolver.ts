import {
  Args,
  Mutation,
  Query,
  Resolver,
} from '@nestjs/graphql';
import { WalletModel } from './models/wallet.model';
import { WalletService } from './wallet.service';
import {
  CreateWalletInput,
  UpdateWalletInput,
} from './inputs/wallet.input';
import { PaginationArgs } from 'src/common/pagination.args';
import { PaginatedWallets } from './types/paginated-wallets.type';
import { RequireTenant } from 'src/common/decorators/skip-tenant.decorator';
import { AuthContext as AuthContextDecorator } from 'src/common/decorators/auth-context.decorator';
import type { AuthContext as AuthContextType } from 'src/common/user-id.store';

@Resolver(() => WalletModel)
export class WalletResolver {
  constructor(private readonly walletService: WalletService) {}

  @RequireTenant()
  @Query(() => PaginatedWallets)
  async wallets(
    @AuthContextDecorator() ctx: AuthContextType,
    @Args() pagination?: PaginationArgs,
    @Args('search', { nullable: true }) search?: string,
  ) {
    const { take = 25, skip = 0 } = pagination ?? {};
    return this.walletService.findMany(ctx, { take, skip, search });
  }

  @RequireTenant()
  @Query(() => WalletModel, { nullable: true })
  async wallet(
    @AuthContextDecorator() ctx: AuthContextType,
    @Args('id') id: string,
  ) {
    return this.walletService.findOne(ctx, id);
  }

  @RequireTenant()
  @Mutation(() => WalletModel)
  async createOneWallet(
    @AuthContextDecorator() ctx: AuthContextType,
    @Args('input') input: CreateWalletInput,
  ) {
    return this.walletService.create(ctx, input);
  }

  @RequireTenant()
  @Mutation(() => WalletModel)
  async updateOneWallet(
    @AuthContextDecorator() ctx: AuthContextType,
    @Args('input') input: UpdateWalletInput,
  ) {
    return this.walletService.update(ctx, input);
  }

  @RequireTenant()
  @Mutation(() => WalletModel)
  async deleteOneWallet(
    @AuthContextDecorator() ctx: AuthContextType,
    @Args('id') id: string,
  ) {
    return this.walletService.remove(ctx, id);
  }
}
