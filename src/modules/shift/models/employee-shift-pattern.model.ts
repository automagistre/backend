import { Field, ObjectType } from '@nestjs/graphql';

@ObjectType({ description: 'Цикл графика сотрудника' })
export class EmployeeShiftPatternModel {
  @Field(() => String, {
    description: 'Маска цикла из 1 и 0: 5/2 это 1111100',
  })
  mask: string;

  @Field(() => String, {
    description: 'Дата первого символа маски, ГГГГ-ММ-ДД',
  })
  startsOn: string;
}
