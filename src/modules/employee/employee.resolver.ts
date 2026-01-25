import { Args, Mutation, Parent, Query, ResolveField, Resolver } from '@nestjs/graphql';
import { EmployeeModel } from './models/employee.model';
import { EmployeeService } from './employee.service';
import { CreateEmployeeInput, UpdateEmployeeInput } from './inputs/employee.input';
import { PaginationArgs } from 'src/common/pagination.args';
import { PaginatedEmployees } from './types/paginated-employees.type';
import { Employee } from '@prisma/client';

@Resolver(() => EmployeeModel)
export class EmployeeResolver {
  constructor(private readonly employeeService: EmployeeService) {}

  @Query(() => PaginatedEmployees)
  async employees(
    @Args() pagination?: PaginationArgs,
    @Args('search', { nullable: true }) search?: string,
    @Args('includeFired', { nullable: true, defaultValue: false }) includeFired?: boolean,
  ) {
    if (!pagination) {
      pagination = { take: undefined, skip: undefined };
    }
    const { take = 25, skip = 0 } = pagination;
    const itemsPaginated = await this.employeeService.findMany({
      take,
      skip,
      search,
      includeFired,
    });
    return itemsPaginated;
  }

  @Query(() => EmployeeModel, { nullable: true })
  async employee(@Args('id') id: string) {
    return this.employeeService.findOne(id);
  }

  @Mutation(() => EmployeeModel)
  async createOneEmployee(@Args('input') input: CreateEmployeeInput) {
    return await this.employeeService.create(input);
  }

  @Mutation(() => EmployeeModel)
  async updateOneEmployee(@Args('input') input: UpdateEmployeeInput) {
    return await this.employeeService.update(input);
  }

  @Mutation(() => EmployeeModel)
  async fireEmployee(@Args('id') id: string) {
    return await this.employeeService.fire(id);
  }

  @Mutation(() => EmployeeModel)
  async deleteOneEmployee(@Args('id') id: string) {
    return await this.employeeService.remove(id);
  }

  @ResolveField(() => Boolean)
  async isFired(@Parent() employee: Employee): Promise<boolean> {
    return employee.firedAt !== null;
  }
}

