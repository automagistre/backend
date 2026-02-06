import { Field, ID, InputType } from '@nestjs/graphql';
import { IsUUID } from 'class-validator';
import { NoteType } from '../enums/note-type.enum';

@InputType()
export class CreateNoteInput {
  @IsUUID()
  @Field(() => ID, { description: 'ID сущности (Order, Car, Person)' })
  subjectId: string;

  @Field(() => NoteType, { description: 'Тип заметки' })
  type: NoteType;

  @Field({ description: 'Текст заметки' })
  text: string;

  @Field(() => Boolean, { nullable: true, defaultValue: false })
  isPublic?: boolean;
}
