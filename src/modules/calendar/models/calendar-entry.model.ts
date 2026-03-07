import { Field, ID, ObjectType } from '@nestjs/graphql';
import { CalendarEntryScheduleModel } from './calendar-entry-schedule.model';
import { CalendarEntryOrderInfoModel } from './calendar-entry-order-info.model';
import { OrderModel } from '../../order/models/order.model';

@ObjectType({ description: 'Запись в календаре' })
export class CalendarEntryModel {
  @Field(() => ID)
  id: string;

  @Field(() => Date, { nullable: true })
  createdAt: Date | null;

  @Field(() => ID, { nullable: true })
  createdBy: string | null;

  @Field(() => CalendarEntryScheduleModel, {
    nullable: true,
    description: 'Актуальное расписание (последняя версия)',
  })
  schedule?: CalendarEntryScheduleModel | null;

  @Field(() => CalendarEntryOrderInfoModel, {
    nullable: true,
    description: 'Информация о заказе (последняя версия)',
  })
  orderInfo?: CalendarEntryOrderInfoModel | null;

  @Field(() => OrderModel, {
    nullable: true,
    description: 'Заказ, связанный с записью',
  })
  order?: OrderModel | null;

  // Технические поля для ResolveField из prisma include.
  calendarEntrySchedule?: CalendarEntryScheduleModel[];
  calendarEntryOrderInfo?: CalendarEntryOrderInfoModel[];
}
