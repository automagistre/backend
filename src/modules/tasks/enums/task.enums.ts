import { registerEnumType } from '@nestjs/graphql';
import {
  TaskResult as PrismaTaskResult,
  TaskStatus as PrismaTaskStatus,
  TaskType as PrismaTaskType,
} from 'src/generated/prisma/enums';

export const TaskTypeEnum = PrismaTaskType;
export type TaskTypeEnum = (typeof TaskTypeEnum)[keyof typeof TaskTypeEnum];

export const TaskStatusEnum = PrismaTaskStatus;
export type TaskStatusEnum =
  (typeof TaskStatusEnum)[keyof typeof TaskStatusEnum];

export const TaskResultEnum = PrismaTaskResult;
export type TaskResultEnum =
  (typeof TaskResultEnum)[keyof typeof TaskResultEnum];

registerEnumType(TaskTypeEnum, {
  name: 'TaskType',
});

registerEnumType(TaskStatusEnum, {
  name: 'TaskStatus',
});

registerEnumType(TaskResultEnum, {
  name: 'TaskResult',
});
