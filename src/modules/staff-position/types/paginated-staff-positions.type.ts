import { Field, Int, ObjectType } from '@nestjs/graphql';
import { StaffPositionModel } from '../models/staff-position.model';

@ObjectType()
export class PaginatedStaffPositions {
  @Field(() => [StaffPositionModel])
  items: StaffPositionModel[];

  @Field(() => Int)
  total: number;
}
