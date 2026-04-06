import {
  Args,
  Mutation,
  Parent,
  Query,
  ResolveField,
  Resolver,
} from '@nestjs/graphql';
import { CustomerTransactionModel } from './models/customer-transaction.model';
import { CustomerTransactionService } from './customer-transaction.service';
import { CreateManualCustomerTransactionInput } from './inputs/create-manual-customer-transaction.input';
import { PaginationArgs } from 'src/common/pagination.args';
import { PaginatedCustomerTransactions } from './types/paginated-customer-transactions.type';
import { RequireTenant } from 'src/common/decorators/skip-tenant.decorator';
import { AuthContext as AuthContextDecorator } from 'src/common/decorators/auth-context.decorator';
import type { AuthContext as AuthContextType } from 'src/common/user-id.store';
import { AppUserModel } from '../app-user/models/app-user.model';
import { AppUserLoader } from '../app-user/app-user.loader';

@Resolver(() => CustomerTransactionModel)
export class CustomerTransactionResolver {
  constructor(
    private readonly customerTransactionService: CustomerTransactionService,
    private readonly appUserLoader: AppUserLoader,
  ) {}

  @RequireTenant()
  @ResolveField(() => String)
  async sourceDisplay(
    @AuthContextDecorator() ctx: AuthContextType,
    @Parent() tx: { source: number; sourceId: string },
  ): Promise<string> {
    return this.customerTransactionService.getSourceDisplay(
      ctx,
      tx.source,
      tx.sourceId,
    );
  }

  @ResolveField(() => String, {
    nullable: true,
    description: 'ФИО операнда (для отображения в сводке)',
  })
  async operandDisplayName(
    @Parent() tx: { operandId: string },
  ): Promise<string | null> {
    return this.customerTransactionService.getOperandDisplayName(tx.operandId);
  }

  @RequireTenant()
  @Query(() => PaginatedCustomerTransactions)
  async customerTransactions(
    @AuthContextDecorator() ctx: AuthContextType,
    @Args('operandId') operandId: string,
    @Args() pagination?: PaginationArgs,
    @Args('dateFrom', { nullable: true }) dateFrom?: Date,
    @Args('dateTo', { nullable: true }) dateTo?: Date,
  ) {
    const { take = 25, skip = 0 } = pagination ?? {};
    return this.customerTransactionService.findMany(ctx, {
      operandId,
      take,
      skip,
      dateFrom,
      dateTo,
    });
  }

  @RequireTenant()
  @Query(() => BigInt, {
    description: 'Баланс операнда (сумма проводок)',
  })
  async customerBalance(
    @AuthContextDecorator() ctx: AuthContextType,
    @Args('operandId') operandId: string,
  ) {
    return this.customerTransactionService.getBalance(ctx, operandId);
  }

  @RequireTenant()
  @Mutation(() => CustomerTransactionModel)
  async createManualCustomerTransaction(
    @AuthContextDecorator() ctx: AuthContextType,
    @Args('input') input: CreateManualCustomerTransactionInput,
  ) {
    return this.customerTransactionService.createManualTransaction(ctx, input);
  }

  @ResolveField(() => AppUserModel, { nullable: true })
  async createdByUser(@Parent() tx: CustomerTransactionModel) {
    if (!tx.createdBy) return null;
    return this.appUserLoader.load(tx.createdBy);
  }
}
