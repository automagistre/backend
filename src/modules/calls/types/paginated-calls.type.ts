import { Field, Int, ObjectType } from '@nestjs/graphql';
import { CallModel } from '../models/call.model';

@ObjectType()
export class PaginatedCalls {
  @Field(() => [CallModel])
  items: CallModel[];

  @Field(() => Int)
  total: number;
}
