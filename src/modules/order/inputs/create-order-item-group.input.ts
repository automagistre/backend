import { Field, ID, InputType } from '@nestjs/graphql';

@InputType()
export class CreateOrderItemGroupInput {
  @Field(() => ID)
  orderId: string;

  @Field(() => ID, { nullable: true })
  parentId?: string;

  @Field(() => ID, { nullable: true })
  tenantId?: string;

  @Field(() => String)
  name: string;

  @Field(() => Boolean, { defaultValue: false, nullable: true })
  hideParts?: boolean;
}
