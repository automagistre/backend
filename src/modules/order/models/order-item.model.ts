import { Field, ID, ObjectType } from '@nestjs/graphql';
import { OrderItemGroupModel } from './order-item-group.model';
import { OrderItemServiceModel } from './order-item-service.model';
import { OrderItemPartModel } from './order-item-part.model';
import { EmployeeModel } from '../../employee/models/employee.model';
import { OrderItemType } from '../enums/order-item-type.enum';

@ObjectType({ description: 'Элемент заказа' })
export class OrderItemModel {
  @Field(() => ID)
  id: string;

  @Field(() => ID, { nullable: true })
  orderId: string | null;

  @Field(() => ID, { nullable: true })
  parentId: string | null;

  @Field(() => OrderItemType)
  type: OrderItemType;

  @Field(() => OrderItemGroupModel, { nullable: true })
  group?: OrderItemGroupModel | null;

  @Field(() => OrderItemServiceModel, { nullable: true })
  service?: OrderItemServiceModel | null;

  @Field(() => OrderItemPartModel, { nullable: true })
  part?: OrderItemPartModel | null;

  @Field(() => [OrderItemModel])
  children: OrderItemModel[];

  // Поле для резолвинга worker из service
  @Field(() => EmployeeModel, { nullable: true })
  serviceWorker?: EmployeeModel | null;
}
