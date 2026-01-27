import {
  Field,
  ID,
  InputType,
  OmitType,
  PartialType,
  registerEnumType,
} from '@nestjs/graphql';

export enum DeletionReason {
  NO_REASON = 1,
  PLAN_ANOTHER_TIME = 2,
  NOT_HAVE_TIME_TO_ARRIVE = 3,
  SOLVE_PROBLEM_WITHOUT_SERVICE = 4,
  WE_ARE_CONDOMS = 5,
}

export const DeletionReasonLabels: Record<DeletionReason, string> = {
  [DeletionReason.NO_REASON]: 'Заказчик отменил запись без причины',
  [DeletionReason.PLAN_ANOTHER_TIME]:
    'Заказчик планирует записаться на другое время',
  [DeletionReason.NOT_HAVE_TIME_TO_ARRIVE]: 'Заказчик не успевает приехать',
  [DeletionReason.SOLVE_PROBLEM_WITHOUT_SERVICE]:
    'Заказчик решил проблему до приезда в сервис',
  [DeletionReason.WE_ARE_CONDOMS]:
    'Заказчик где то узнал что мы гондоны и не приехал',
};

registerEnumType(DeletionReason, {
  name: 'DeletionReason',
  description: 'Причины удаления записи в календаре',
});

@InputType()
export class CreateCalendarEntryInput {
  @Field(() => ID, { nullable: true, name: 'car' })
  carId?: string;

  @Field(() => ID, { nullable: true, name: 'customer' })
  customerId?: string;

  @Field(() => ID, { nullable: true, name: 'worker' })
  workerId?: string;

  @Field(() => Date, { name: 'startDate' })
  date: Date;

  @Field(() => String)
  duration: string;

  @Field(() => String, { nullable: true, name: 'description' })
  description?: string;
}

@InputType()
export class UpdateCalendarEntryInput extends PartialType(
  OmitType(CreateCalendarEntryInput, ['carId', 'customerId']),
) {
  @Field(() => ID, { name: 'CalendarEntryId' })
  id: string;

  @Field(() => Date, { name: 'startDate' })
  date: Date;

  @Field(() => String)
  duration: string;
}

@InputType()
export class DeleteCalendarEntryInput {
  @Field(() => ID, { name: 'CalendarEntryId' })
  id: string;

  @Field(() => DeletionReason, { name: 'reason' })
  reason: number;

  @Field(() => String, { nullable: true, name: 'description' })
  description?: string;
}
