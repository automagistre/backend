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

@Resolver(() => WalletModel)
export class WalletResolver {
  constructor(private readonly walletService: WalletService) {}

  @Query(() => PaginatedWallets)
  async wallets(
    @Args() pagination?: PaginationArgs,
    @Args('search', { nullable: true }) search?: string,
  ) {
    const { take = 25, skip = 0 } = pagination ?? {};
    return this.walletService.findMany({ take, skip, search });
  }

  @Query(() => WalletModel, { nullable: true })
  async wallet(@Args('id') id: string) {
    return this.walletService.findOne(id);
  }

  @Mutation(() => WalletModel)
  async createOneWallet(@Args('input') input: CreateWalletInput) {
    return this.walletService.create(input);
  }

  @Mutation(() => WalletModel)
  async updateOneWallet(@Args('input') input: UpdateWalletInput) {
    return this.walletService.update(input);
  }

  @Mutation(() => WalletModel)
  async deleteOneWallet(@Args('id') id: string) {
    return this.walletService.remove(id);
  }
}
