import { Field, Int, ObjectType } from '@nestjs/graphql';
import { CallRoutingBindingModel } from '../models/call-routing-binding.model';

@ObjectType()
export class PaginatedCallRoutingBindings {
  @Field(() => [CallRoutingBindingModel])
  items: CallRoutingBindingModel[];

  @Field(() => Int)
  total: number;
}
