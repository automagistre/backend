import { Field, ID, ObjectType } from '@nestjs/graphql';
import { EmployeeShiftPatternModel } from 'src/modules/shift/models/employee-shift-pattern.model';

@ObjectType({
  description: 'Цикл графика сотрудника в одной из его должностей',
})
export class EmployeePositionShiftModel {
  @Field(() => ID, { description: 'ID должности' })
  positionId: string;

  @Field(() => EmployeeShiftPatternModel, {
    nullable: true,
    description: 'Цикл. null — в этой должности только по отметкам',
  })
  shift: EmployeeShiftPatternModel | null;
}
