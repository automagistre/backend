import { Field, Int, ObjectType } from '@nestjs/graphql';
import { OrderServicesGroupModel } from '../models/order-services-group.model';

@ObjectType()
export class PaginatedCarServices {
  @Field(() => [OrderServicesGroupModel])
  items: OrderServicesGroupModel[];

  @Field(() => Int)
  total: number;
}
