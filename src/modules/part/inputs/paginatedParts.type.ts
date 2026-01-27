import { Field, Int, ObjectType } from '@nestjs/graphql';
import { PartModel } from '../models/part.model';

@ObjectType()
export class PaginatedParts {
  @Field(() => [PartModel])
  items: PartModel[];

  @Field(() => Int)
  total: number;
}
