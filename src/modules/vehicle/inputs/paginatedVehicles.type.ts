import { Field, Int, ObjectType } from '@nestjs/graphql';
import { VehicleModel } from '../models/vahicle.model';

@ObjectType()
export class PaginatedVehicles {
  @Field(() => [VehicleModel])
  items: VehicleModel[];

  @Field(() => Int)
  total: number;
}
