import { Field, ID, Int, ObjectType } from '@nestjs/graphql';
import { Note as PrismaNote } from 'src/generated/prisma/client';
import { NoteType } from '../enums/note-type.enum';

@ObjectType()
export class NoteModel implements PrismaNote {
  @Field(() => ID)
  id: string;

  @Field(() => ID)
  subject: string;

  @Field(() => NoteType)
  type: number;

  @Field()
  text: string;

  @Field(() => Boolean, { nullable: true })
  isPublic: boolean | null;

  @Field(() => ID)
  tenantId: string;

  @Field(() => Date, { nullable: true })
  createdAt: Date | null;

  @Field(() => ID)
  createdBy: string;
}
