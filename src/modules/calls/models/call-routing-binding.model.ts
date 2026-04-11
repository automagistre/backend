import { Field, ID, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class CallRoutingBindingModel {
  @Field(() => ID)
  id: string;

  @Field()
  operator: string;

  @Field(() => String, { nullable: true })
  lineExternalId: string | null;

  @Field(() => String, { nullable: true })
  virtualPhone: string | null;

  @Field(() => String, { nullable: true })
  webhookToken: string | null;

  @Field(() => String, { nullable: true })
  displayName: string | null;

  @Field(() => Boolean)
  isActive: boolean;

  @Field(() => Date, { nullable: true })
  createdAt: Date | null;

  @Field(() => Date, { nullable: true })
  updatedAt: Date | null;
}
