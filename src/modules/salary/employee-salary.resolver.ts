import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import { EmployeeSalaryService } from './employee-salary.service';
import { EmployeeSalaryModel } from './models/employee-salary.model';
import { CreateEmployeeSalaryInput } from './inputs/create-employee-salary.input';

@Resolver(() => EmployeeSalaryModel)
export class EmployeeSalaryResolver {
  constructor(private readonly employeeSalaryService: EmployeeSalaryService) {}

  @Query(() => [EmployeeSalaryModel], {
    name: 'employeeSalaries',
    description: 'Ежемесячные начисления сотрудника',
  })
  async employeeSalaries(
    @Args('employeeId', { type: () => ID }) employeeId: string,
  ) {
    return this.employeeSalaryService.listByEmployee(employeeId);
  }

  @Mutation(() => EmployeeSalaryModel, { name: 'createEmployeeSalary' })
  async createEmployeeSalary(@Args('input') input: CreateEmployeeSalaryInput) {
    const row = await this.employeeSalaryService.create(input);
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
    @Args('salaryId', { type: () => ID }) salaryId: string,
  ) {
    await this.employeeSalaryService.cancel(salaryId);
    return true;
  }
}
