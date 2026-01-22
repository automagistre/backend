import { Field, ID, Int, ObjectType } from '@nestjs/graphql';

@ObjectType({ description: 'Резервация запчасти' })
export class ReservationModel {
  @Field(() => ID)
  id: string;

  @Field(() => ID)
  orderItemPartId: string;

  @Field(() => Int)
  quantity: number;

  @Field(() => ID)
  tenantId: string;

  @Field(() => Date, { nullable: true })
  createdAt?: Date | null;

  @Field(() => ID, { nullable: true })
  createdBy?: string | null;
}
