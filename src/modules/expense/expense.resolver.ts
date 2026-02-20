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
import { AuthContext } from 'src/common/decorators/auth-context.decorator';
import { RequireTenant } from 'src/common/decorators/skip-tenant.decorator';
import type { AuthContext as AuthContextType } from 'src/common/user-id.store';

@Resolver(() => ExpenseModel)
@RequireTenant()
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
    @AuthContext() ctx: AuthContextType,
    @Args() pagination?: PaginationArgs,
    @Args('search', { type: () => String, nullable: true }) search?: string,
  ) {
    const { take = 25, skip = 0 } = pagination ?? {};
    return this.expenseService.findMany(ctx, { take, skip, search });
  }

  @Query(() => ExpenseModel, {
    name: 'expense',
    nullable: true,
    description: 'Статья расходов по ID',
  })
  async expense(@AuthContext() ctx: AuthContextType, @Args('id') id: string) {
    return this.expenseService.findOne(ctx, id);
  }

  @Mutation(() => ExpenseModel, {
    name: 'createExpense',
    description: 'Создать статью расходов',
  })
  async createExpense(
    @AuthContext() ctx: AuthContextType,
    @Args('input') input: CreateExpenseInput,
  ) {
    return this.expenseService.create(ctx, input);
  }

  @Mutation(() => ExpenseModel, {
    name: 'updateExpense',
    description: 'Обновить статью расходов',
  })
  async updateExpense(
    @AuthContext() ctx: AuthContextType,
    @Args('input') input: UpdateExpenseInput,
  ) {
    return this.expenseService.update(ctx, input);
  }

  @Mutation(() => ExpenseModel, {
    name: 'deleteExpense',
    description: 'Удалить статью расходов',
  })
  async deleteExpense(
    @AuthContext() ctx: AuthContextType,
    @Args('id') id: string,
  ) {
    return this.expenseService.remove(ctx, id);
  }

  @Mutation(() => WalletTransactionModel, {
    name: 'createExpenseTransaction',
    description: 'Создать расход по статье (проводка списания)',
  })
  async createExpenseTransaction(
    @AuthContext() ctx: AuthContextType,
    @Args('input') input: CreateExpenseTransactionInput,
  ) {
    return this.expenseService.createExpenseTransaction(ctx, input);
  }
}
