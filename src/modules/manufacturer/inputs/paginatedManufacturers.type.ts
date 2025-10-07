import { Field, Int, ObjectType } from '@nestjs/graphql';
import { ManufacturerModel } from '../models/manufacturer.model';

@ObjectType()
export class PaginatedManufacturers {
  @Field(() => [ManufacturerModel])
  items: ManufacturerModel[];

  @Field(() => Int)
  total: number;
}
