import { Field, ID, InputType } from '@nestjs/graphql';
import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import { CallCallbackStatusEnum, CallStatusEnum } from '../enums/call.enums';

@InputType()
export class CallFilterInput {
  @Field(() => Boolean, { nullable: true })
  @IsOptional()
  @IsBoolean()
  isMissed?: boolean;

  @Field(() => CallStatusEnum, { nullable: true })
  @IsOptional()
  @IsEnum(CallStatusEnum)
  status?: CallStatusEnum;

  @Field(() => CallCallbackStatusEnum, { nullable: true })
  @IsOptional()
  @IsEnum(CallCallbackStatusEnum)
  callbackStatus?: CallCallbackStatusEnum;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  search?: string;

  @Field(() => ID, { nullable: true })
  @IsOptional()
  @IsUUID()
  personId?: string;
}
