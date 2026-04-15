import { Field, Int, ObjectType } from '@nestjs/graphql';

@ObjectType({ description: 'Счётчики задач для бейджей' })
export class TasksCountModel {
  @Field(() => Int, { description: 'TODO с наступившим scheduledAt' })
  pending: number;

  @Field(() => Int, { description: 'TODO/IN_PROGRESS просроченные (>24ч)' })
  overdue: number;

  @Field(() => Int, { description: 'В работе' })
  inProgress: number;
}
