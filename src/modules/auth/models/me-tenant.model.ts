import { ObjectType, Field, ID } from '@nestjs/graphql';

@ObjectType()
export class MeTenantModel {
  @Field(() => ID)
  id: string;

  @Field(() => String, { nullable: true })
  name?: string;
}
