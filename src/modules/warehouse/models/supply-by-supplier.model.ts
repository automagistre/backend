import { Field, Int, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class SupplyBySupplierModel {
  @Field(() => String)
  supplierId: string;

  @Field(() => Int)
  quantity: number;

  @Field(() => Date)
  updatedAt: Date;
}
