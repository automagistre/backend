import {
  Args,
  Mutation,
  Parent,
  Query,
  ResolveField,
  Resolver,
} from '@nestjs/graphql';
import { EmployeeModel } from './models/employee.model';
import { EmployeeService } from './employee.service';
import {
  CreateEmployeeInput,
  UpdateEmployeeInput,
} from './inputs/employee.input';
import { PaginationArgs } from 'src/common/pagination.args';
import { PaginatedEmployees } from './types/paginated-employees.type';
import { Employee } from '@prisma/client';
import { AuthContext } from 'src/common/decorators/auth-context.decorator';
import { RequireTenant } from 'src/common/decorators/skip-tenant.decorator';
import type { AuthContext as AuthContextType } from 'src/common/user-id.store';

@Resolver(() => EmployeeModel)
@RequireTenant()
export class EmployeeResolver {
  constructor(private readonly employeeService: EmployeeService) {}

  @Query(() => PaginatedEmployees)
  async employees(
    @AuthContext() ctx: AuthContextType,
    @Args() pagination?: PaginationArgs,
    @Args('search', { nullable: true }) search?: string,
    @Args('includeFired', { nullable: true, defaultValue: false })
    includeFired?: boolean,
  ) {
    if (!pagination) {
      pagination = { take: undefined, skip: undefined };
    }
    const { take = 25, skip = 0 } = pagination;
    return this.employeeService.findMany(ctx, {
      take,
      skip,
      search,
      includeFired,
    });
  }

  @Query(() => EmployeeModel, { nullable: true })
  async employee(@AuthContext() ctx: AuthContextType, @Args('id') id: string) {
    return this.employeeService.findOne(ctx, id);
  }

  @Mutation(() => EmployeeModel)
  async createOneEmployee(
    @AuthContext() ctx: AuthContextType,
    @Args('input') input: CreateEmployeeInput,
  ) {
    return this.employeeService.create(ctx, input);
  }

  @Mutation(() => EmployeeModel)
  async updateOneEmployee(
    @AuthContext() ctx: AuthContextType,
    @Args('input') input: UpdateEmployeeInput,
  ) {
    return this.employeeService.update(ctx, input);
  }

  @Mutation(() => EmployeeModel)
  async fireEmployee(
    @AuthContext() ctx: AuthContextType,
    @Args('id') id: string,
  ) {
    return this.employeeService.fire(ctx, id);
  }

  @Mutation(() => EmployeeModel)
  async deleteOneEmployee(
    @AuthContext() ctx: AuthContextType,
    @Args('id') id: string,
  ) {
    return this.employeeService.remove(ctx, id);
  }

  @ResolveField(() => Boolean)
  async isFired(@Parent() employee: Employee): Promise<boolean> {
    return employee.firedAt !== null;
  }
}
