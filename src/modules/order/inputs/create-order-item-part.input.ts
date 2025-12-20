import { Field, ID, Int, InputType } from '@nestjs/graphql';

@InputType()
export class CreateOrderItemPartInput {
  @Field(() => ID)
  orderId: string;

  @Field(() => ID, { nullable: true })
  parentId?: string;

  @Field(() => ID)
  tenantId: string;

  @Field(() => ID)
  partId: string;

  @Field(() => ID, { nullable: true })
  supplierId?: string;

  @Field(() => Int)
  quantity: number;

  @Field(() => Boolean, { defaultValue: false, nullable: true })
  warranty?: boolean;

  @Field(() => BigInt, { nullable: true })
  priceAmount?: bigint;

  @Field(() => BigInt, { nullable: true })
  discountAmount?: bigint;
}

