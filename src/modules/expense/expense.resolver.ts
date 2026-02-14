import {
  Args,
  Mutation,
  Parent,
  Query,
  ResolveField,
  Resolver,
} from '@nestjs/graphql';
import { ExpenseModel } from './models/expense.model';
import { ExpenseService } from './expense.service';
import { CreateExpenseInput } from './inputs/create-expense.input';
import { UpdateExpenseInput } from './inputs/update-expense.input';
import { CreateExpenseTransactionInput } from './inputs/create-expense-transaction.input';
import { PaginationArgs } from 'src/common/pagination.args';
import { PaginatedExpenses } from './types/paginated-expenses.type';
import { WalletModel } from 'src/modules/wallet/models/wallet.model';
import { WalletService } from 'src/modules/wallet/wallet.service';
import { WalletTransactionModel } from 'src/modules/wallet/models/wallet-transaction.model';

@Resolver(() => ExpenseModel)
export class ExpenseResolver {
  constructor(
    private readonly expenseService: ExpenseService,
    private readonly walletService: WalletService,
  ) {}

  @ResolveField('wallet', () => WalletModel, { nullable: true })
  async wallet(@Parent() expense: { walletId: string | null }) {
    if (!expense.walletId) return null;
    return this.walletService.findOne(expense.walletId);
  }

  @Query(() => PaginatedExpenses, {
    name: 'expenses',
    description: 'Список статей расходов',
  })
  async expenses(
    @Args() pagination?: PaginationArgs,
    @Args('search', { nullable: true }) search?: string,
  ) {
    const { take = 25, skip = 0 } = pagination ?? {};
    return this.expenseService.findMany({ take, skip, search });
  }

  @Query(() => ExpenseModel, {
    name: 'expense',
    nullable: true,
    description: 'Статья расходов по ID',
  })
  async expense(@Args('id') id: string) {
    return this.expenseService.findOne(id);
  }

  @Mutation(() => ExpenseModel, {
    name: 'createExpense',
    description: 'Создать статью расходов',
  })
  async createExpense(@Args('input') input: CreateExpenseInput) {
    return this.expenseService.create(input);
  }

  @Mutation(() => ExpenseModel, {
    name: 'updateExpense',
    description: 'Обновить статью расходов',
  })
  async updateExpense(@Args('input') input: UpdateExpenseInput) {
    return this.expenseService.update(input);
  }

  @Mutation(() => ExpenseModel, {
    name: 'deleteExpense',
    description: 'Удалить статью расходов',
  })
  async deleteExpense(@Args('id') id: string) {
    return this.expenseService.remove(id);
  }

  @Mutation(() => WalletTransactionModel, {
    name: 'createExpenseTransaction',
    description: 'Создать расход по статье (проводка списания)',
  })
  async createExpenseTransaction(
    @Args('input') input: CreateExpenseTransactionInput,
  ) {
    return this.expenseService.createExpenseTransaction(input);
  }
}
