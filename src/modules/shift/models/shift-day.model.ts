import { Field, ID, ObjectType } from '@nestjs/graphql';
import { ShiftDayKind } from '../enums/shift-day-kind.enum';

/**
 * Готовый ответ «работает ли сотрудник в этот день»: цикл и отметки уже сведены,
 * клиент их не пересчитывает.
 */
@ObjectType({ description: 'День графика сотрудника' })
export class ShiftDayModel {
  @Field(() => ID)
  employeeId: string;

  /** Дата, а не момент времени: строка не съезжает на сутки при смене пояса. */
  @Field(() => String, { description: 'Дата дня, ГГГГ-ММ-ДД' })
  date: string;

  @Field(() => Boolean, { description: 'Сотрудник в смене' })
  working: boolean;

  @Field(() => ShiftDayKind, {
    nullable: true,
    description: 'Отметка на день. null — день идёт по циклу',
  })
  kind: ShiftDayKind | null;

  @Field(() => String, { nullable: true })
  comment: string | null;

  @Field(() => Boolean, {
    description:
      'Занимает колонку в календаре: в смене и должность это позволяет',
  })
  occupiesColumn: boolean;
}
