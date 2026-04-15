import { Field, InputType } from '@nestjs/graphql';
import { IsBoolean, IsEnum, IsOptional } from 'class-validator';
import { TaskTypeEnum } from '../enums/task.enums';

@InputType()
export class TaskBoardFilterInput {
  @Field(() => TaskTypeEnum, { nullable: true })
  @IsOptional()
  @IsEnum(TaskTypeEnum)
  type?: TaskTypeEnum;

  @Field(() => Boolean, { nullable: true })
  @IsOptional()
  @IsBoolean()
  includeArchived?: boolean;
}
