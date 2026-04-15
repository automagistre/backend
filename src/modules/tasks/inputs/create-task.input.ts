import { Field, ID, InputType } from '@nestjs/graphql';
import {
  IsArray,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { TaskTypeEnum } from '../enums/task.enums';

@InputType()
export class CreateTaskInput {
  @Field(() => TaskTypeEnum)
  type: TaskTypeEnum;

  @Field(() => String)
  @IsString()
  @MaxLength(255)
  title: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string | null;

  @Field(() => ID, { nullable: true })
  @IsOptional()
  @IsUUID()
  orderId?: string | null;

  @Field(() => ID, { nullable: true })
  @IsOptional()
  @IsUUID()
  customerId?: string | null;

  @Field(() => Date, { nullable: true })
  @IsOptional()
  scheduledAt?: Date | null;

  @Field(() => [String], { nullable: true })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(64, { each: true })
  tags?: string[] | null;
}
