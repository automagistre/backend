import { Field, ID, Int, ObjectType } from '@nestjs/graphql';
import { CarModel } from '../../vehicle/models/car.model';
import { PersonModel } from '../../person/models/person.model';
import { EmployeeModel } from '../../employee/models/employee.model';
import { OrderPaymentModel } from './order-payment.model';
import { OrderStatus } from '../enums/order-status.enum';

@ObjectType({ description: 'Заказ' })
export class OrderModel {
  @Field(() => ID)
  id: string;

  @Field(() => Int)
  number: number;

  @Field(() => OrderStatus)
  status: OrderStatus;

  @Field(() => ID, { nullable: true })
  carId: string | null;

  @Field(() => ID, { nullable: true })
  customerId: string | null;

  @Field(() => ID, { nullable: true })
  workerId: string | null;

  @Field(() => Int, { nullable: true })
  mileage: number | null;

  @Field(() => String, { nullable: true })
  description: string | null;

  @Field(() => Date, { nullable: true })
  createdAt: Date | null;

  @Field(() => Date, { nullable: true })
  closedAt?: Date | null;

  @Field(() => ID, { nullable: true })
  createdBy: string | null;

  @Field(() => Boolean, {
    description:
      'Можно удалить заказ (пустой, в течение периода охлаждения)',
  })
  canDelete?: boolean;

  @Field(() => CarModel, { nullable: true })
  car?: CarModel | null;

  @Field(() => PersonModel, { nullable: true })
  customer?: PersonModel | null;

  @Field(() => EmployeeModel, { nullable: true })
  worker?: EmployeeModel | null;

  @Field(() => [OrderPaymentModel], {
    description: 'Предоплаты по заказу',
  })
  prepayments?: OrderPaymentModel[];

  tenantId: string;
}
