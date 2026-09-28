import { Field, ID, InputType } from '@nestjs/graphql';
import { ShiftDayKind } from '../enums/shift-day-kind.enum';

/** Диапазон дат: в интерфейсе отпуск и больничный проставляют периодом, а не по дню. */
@InputType()
export class ShiftDaysRangeInput {
  @Field(() => ID)
  employeeId: string;

  @Field(() => String, { description: 'Первый день диапазона, ГГГГ-ММ-ДД' })
  from: string;

  @Field(() => String, { description: 'Последний день диапазона, ГГГГ-ММ-ДД' })
  to: string;

  @Field(() => ID, {
    nullable: true,
    description:
      'Должность. Для выхода и отгула обязательна, для отпуска и больничного не передаётся. ' +
      'При снятии: с должностью — отметки должности и на человека, без — все',
  })
  positionId?: string | null;
}

@InputType()
export class SetShiftDaysInput extends ShiftDaysRangeInput {
  @Field(() => ShiftDayKind)
  kind: ShiftDayKind;

  @Field(() => String, { nullable: true })
  comment?: string | null;
}
