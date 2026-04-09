import { Field, ID, InputType } from '@nestjs/graphql';
import { IsUUID } from 'class-validator';

@InputType()
export class MarkCallCallbackInput {
  @Field(() => ID)
  @IsUUID()
  callId: string;
}
