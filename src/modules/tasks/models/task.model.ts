import { Field, ID, ObjectType } from '@nestjs/graphql';
import { OrderModel } from '../../order/models/order.model';
import {
  TaskResultEnum,
  TaskStatusEnum,
  TaskTypeEnum,
} from '../enums/task.enums';

@ObjectType({ description: 'Задача для канбан-доски' })
export class TaskModel {
  @Field(() => ID)
  id: string;

  @Field(() => TaskTypeEnum)
  type: TaskTypeEnum;

  @Field(() => TaskStatusEnum)
  status: TaskStatusEnum;

  @Field(() => String)
  title: string;

  @Field(() => String, { nullable: true })
  description: string | null;

  @Field(() => ID, { nullable: true })
  orderId: string | null;

  @Field(() => OrderModel, { nullable: true })
  order?: OrderModel | null;

  @Field(() => ID, { nullable: true })
  customerId: string | null;

  @Field(() => ID, { nullable: true })
  assigneeUserId: string | null;

  @Field(() => Date, { nullable: true })
  scheduledAt: Date | null;

  @Field(() => Date, { nullable: true })
  completedAt: Date | null;

  @Field(() => Date, { nullable: true })
  archivedAt: Date | null;

  @Field(() => TaskResultEnum, { nullable: true })
  result: TaskResultEnum | null;

  @Field(() => Boolean)
  requiresManagementAction: boolean;

  @Field(() => String, { nullable: true })
  notes: string | null;

  @Field(() => [String])
  tags: string[];

  @Field(() => Date, { nullable: true })
  createdAt: Date | null;

  @Field(() => Date, { nullable: true })
  updatedAt: Date | null;
}
