import { Field, ID, InputType, Int } from '@nestjs/graphql';

@InputType()
export class ReservePartInput {
  @Field(() => ID)
  orderItemPartId: string;

  @Field(() => Int)
  quantity: number;

  @Field(() => ID, { nullable: true })
  tenantId?: string;
}
