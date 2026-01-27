import { Field, Int, ObjectType } from '@nestjs/graphql';
import { EmployeeModel } from '../models/employee.model';

@ObjectType()
export class PaginatedEmployees {
  @Field(() => [EmployeeModel])
  items: EmployeeModel[];

  @Field(() => Int)
  total: number;
}
