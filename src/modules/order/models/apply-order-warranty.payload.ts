import { Field, ID, Int, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class ApplyOrderWarrantyPayload {
  @Field(() => ID)
  orderId: string;

  @Field(() => Int, { description: 'Количество обновлённых позиций' })
  updatedCount: number;

  @Field(() => ID, { nullable: true, description: 'ID заметки с причиной (если warranty=true)' })
  noteId?: string | null;
}
