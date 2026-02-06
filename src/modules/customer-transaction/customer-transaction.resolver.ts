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

@Resolver(() => CustomerTransactionModel)
export class CustomerTransactionResolver {
  constructor(
    private readonly customerTransactionService: CustomerTransactionService,
  ) {}

  @ResolveField(() => String)
  async sourceDisplay(
    @Parent() tx: { source: number; sourceId: string },
  ): Promise<string> {
    return this.customerTransactionService.getSourceDisplay(
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

  @Query(() => PaginatedCustomerTransactions)
  async customerTransactions(
    @Args('operandId') operandId: string,
    @Args() pagination?: PaginationArgs,
    @Args('dateFrom', { nullable: true }) dateFrom?: Date,
    @Args('dateTo', { nullable: true }) dateTo?: Date,
  ) {
    const { take = 25, skip = 0 } = pagination ?? {};
    return this.customerTransactionService.findMany({
      operandId,
      take,
      skip,
      dateFrom,
      dateTo,
    });
  }

  @Query(() => BigInt, {
    description: 'Баланс операнда (сумма проводок)',
  })
  async customerBalance(@Args('operandId') operandId: string) {
    return this.customerTransactionService.getBalance(operandId);
  }

  @Mutation(() => CustomerTransactionModel)
  async createManualCustomerTransaction(
    @Args('input') input: CreateManualCustomerTransactionInput,
  ) {
    return this.customerTransactionService.createManualTransaction(input);
  }
}
