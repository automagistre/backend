import { Field, ID, InputType } from '@nestjs/graphql';

@InputType()
export class CreateOrderItemServiceInput {
  @Field(() => ID)
  orderId: string;

  @Field(() => ID, { nullable: true })
  parentId?: string;

  @Field(() => ID, { nullable: true })
  tenantId?: string;

  @Field(() => String)
  service: string;

  @Field(() => ID, { nullable: true })
  workerId?: string;

  @Field(() => Boolean, { defaultValue: false, nullable: true })
  warranty?: boolean;

  @Field(() => BigInt, { nullable: true })
  priceAmount?: bigint | null;

  @Field(() => BigInt, { nullable: true })
  discountAmount?: bigint | null;
}
