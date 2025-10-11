import { Field, Int, ObjectType } from '@nestjs/graphql';
import { CarModel } from '../models/car.model';

@ObjectType()
export class PaginatedCars {
  @Field(() => [CarModel])
  items: CarModel[];

  @Field(() => Int)
  total: number;
}

