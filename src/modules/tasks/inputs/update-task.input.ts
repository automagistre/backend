import { Field, ID, InputType } from '@nestjs/graphql';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { TaskResultEnum, TaskStatusEnum } from '../enums/task.enums';

@InputType()
export class UpdateTaskInput {
  @Field(() => ID)
  @IsUUID()
  id: string;

  @Field(() => TaskStatusEnum, { nullable: true })
  @IsOptional()
  @IsEnum(TaskStatusEnum)
  status?: TaskStatusEnum;

  @Field(() => TaskResultEnum, { nullable: true })
  @IsOptional()
  @IsEnum(TaskResultEnum)
  result?: TaskResultEnum;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string | null;

  @Field(() => [String], { nullable: true })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(64, { each: true })
  tags?: string[] | null;

  @Field(() => Boolean, { nullable: true })
  @IsOptional()
  @IsBoolean()
  requiresManagementAction?: boolean;

  @Field(() => ID, { nullable: true })
  @IsOptional()
  @IsUUID()
  assigneeUserId?: string | null;
}
