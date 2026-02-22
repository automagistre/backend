import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import { EmployeeSalaryService } from './employee-salary.service';
import { EmployeeSalaryModel } from './models/employee-salary.model';
import { CreateEmployeeSalaryInput } from './inputs/create-employee-salary.input';
import { AuthContext } from 'src/common/decorators/auth-context.decorator';
import { RequireTenant } from 'src/common/decorators/skip-tenant.decorator';
import type { AuthContext as AuthContextType } from 'src/common/user-id.store';

@Resolver(() => EmployeeSalaryModel)
@RequireTenant()
export class EmployeeSalaryResolver {
  constructor(private readonly employeeSalaryService: EmployeeSalaryService) {}

  @Query(() => [EmployeeSalaryModel], {
    name: 'employeeSalaries',
    description: 'Ежемесячные начисления сотрудника',
  })
  async employeeSalaries(
    @AuthContext() ctx: AuthContextType,
    @Args('employeeId', { type: () => ID }) employeeId: string,
  ) {
    return this.employeeSalaryService.listByEmployee(ctx, employeeId);
  }

  @Mutation(() => EmployeeSalaryModel, { name: 'createEmployeeSalary' })
  async createEmployeeSalary(
    @AuthContext() ctx: AuthContextType,
    @Args('input') input: CreateEmployeeSalaryInput,
  ) {
    const row = await this.employeeSalaryService.create(ctx, input);
    return {
      id: row.id,
      employeeId: row.employeeId,
      payday: row.payday,
      amount: row.amount,
      createdAt: row.createdAt,
      isCancelled: false,
    };
  }

  @Mutation(() => Boolean, { name: 'cancelEmployeeSalary' })
  async cancelEmployeeSalary(
    @AuthContext() ctx: AuthContextType,
    @Args('salaryId', { type: () => ID }) salaryId: string,
  ) {
    await this.employeeSalaryService.cancel(ctx, salaryId);
    return true;
  }
}
