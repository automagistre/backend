import { Field, ID, ObjectType } from '@nestjs/graphql';

@ObjectType({ description: 'Расписание записи в календаре' })
export class CalendarEntryScheduleModel {
  @Field(() => ID)
  id: string;

  @Field(() => Date, { description: 'Дата и время записи' })
  date: Date;

  @Field(() => String, { description: 'Длительность (ISO 8601 duration)' })
  duration: string;

  @Field(() => Date, { nullable: true })
  createdAt: Date | null;
}
