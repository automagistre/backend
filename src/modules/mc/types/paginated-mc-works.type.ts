import { Field, Int, ObjectType } from '@nestjs/graphql';
import { McWorkModel } from '../models/mc-work.model';

@ObjectType()
export class PaginatedMcWorks {
  @Field(() => [McWorkModel])
  items: McWorkModel[];

  @Field(() => Int)
  total: number;
}
