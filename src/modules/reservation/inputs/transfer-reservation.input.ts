import { Field, ID, InputType, Int } from '@nestjs/graphql';

@InputType()
export class TransferReservationInput {
  @Field(() => ID)
  fromOrderItemPartId: string;

  @Field(() => ID)
  toOrderItemPartId: string;

  @Field(() => Int)
  quantity: number;

  @Field(() => ID, {
    nullable: true,
    deprecationReason: 'Игнорируется: тенант берётся из X-Tenant-Id',
  })
  tenantId?: string;
}
