import { Field, ID, InputType } from '@nestjs/graphql';

@InputType()
export class CreateOrderInput {
  @Field(() => ID, { nullable: true })
  customerId?: string | null;

  @Field(() => ID, { nullable: true })
  carId?: string | null;

  @Field(() => ID, { nullable: true })
  workerId?: string | null;
}
