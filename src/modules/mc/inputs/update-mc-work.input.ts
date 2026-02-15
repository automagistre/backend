import { Field, ID, InputType, Int, PartialType } from '@nestjs/graphql';
import { IsUUID } from 'class-validator';
import { CreateMcWorkInput } from './create-mc-work.input';

@InputType()
export class UpdateMcWorkInput extends PartialType(CreateMcWorkInput) {
  @IsUUID()
  @Field(() => ID)
  id: string;
}
