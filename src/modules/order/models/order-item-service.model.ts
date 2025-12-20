import { Field, ID, ObjectType } from '@nestjs/graphql';
import { EmployeeModel } from '../../employee/models/employee.model';

@ObjectType({ description: 'Услуга в заказе' })
export class OrderItemServiceModel {
  @Field(() => ID)
  id: string;

  @Field(() => String)
  service: string;

  @Field(() => ID, { nullable: true })
  workerId: string | null;

  @Field(() => EmployeeModel, { nullable: true })
  worker?: EmployeeModel | null;

  @Field(() => Boolean)
  warranty: boolean;

  @Field(() => BigInt, { nullable: true })
  priceAmount: bigint | null;

  @Field(() => String, { nullable: true })
  priceCurrencyCode: string | null;

  @Field(() => BigInt, { nullable: true })
  discountAmount: bigint | null;

  @Field(() => String, { nullable: true })
  discountCurrencyCode: string | null;

  @Field(() => Date, { nullable: true })
  createdAt: Date | null;

  @Field(() => ID, { nullable: true })
  createdBy: string | null;
}

