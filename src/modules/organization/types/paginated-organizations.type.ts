import { Field, Int, ObjectType } from '@nestjs/graphql';
import { OrganizationModel } from '../models/organization.model';

@ObjectType()
export class PaginatedOrganizations {
  @Field(() => [OrganizationModel])
  items: OrganizationModel[];

  @Field(() => Int)
  total: number;
}
