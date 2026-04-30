import { Field, Int, ObjectType } from '@nestjs/graphql';

@ObjectType('SiteStatsCustomers')
export class WwwStatsCustomers {
  @Field(() => Int)
  persons: number;

  @Field(() => Int)
  organizations: number;
}

@ObjectType('SiteStats')
export class WwwStats {
  @Field(() => Int)
  orders: number;

  @Field(() => Int)
  vehicles: number;

  @Field(() => WwwStatsCustomers)
  customers: WwwStatsCustomers;

  @Field(() => Int)
  reviews: number;
}
