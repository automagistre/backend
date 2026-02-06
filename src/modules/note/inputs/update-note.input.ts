import { Field, ID, InputType, PartialType } from '@nestjs/graphql';
import { IsUUID } from 'class-validator';
import { CreateNoteInput } from './create-note.input';

@InputType()
export class UpdateNoteInput extends PartialType(CreateNoteInput) {
  @IsUUID()
  @Field(() => ID)
  id: string;
}
