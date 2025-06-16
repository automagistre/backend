import { Field, ObjectType } from '@nestjs/graphql';
import { ManufacturerModel } from '../models/manufacturer.model';

@ObjectType()
export class PaginatedManufacturers {
  @Field(() => [ManufacturerModel])
  items: ManufacturerModel[];

  @Field(() => Boolean)
  hasMore: boolean;

  @Field(() => String, { nullable: true })
  nextCursor?: string;
}
