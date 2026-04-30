import { Field, ID, ObjectType } from '@nestjs/graphql';

@ObjectType('SiteCreateAppealOutput')
export class WwwCreateAppealOutput {
  @Field(() => ID)
  appealId: string;
}
