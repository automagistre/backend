import { Field, ID, Int, ObjectType } from '@nestjs/graphql';
import { Employee } from 'src/generated/prisma/client';
import { PersonModel } from 'src/modules/person/models/person.model';
import { StaffPositionModel } from 'src/modules/staff-position/models/staff-position.model';
import { EmployeePositionShiftModel } from './employee-position-shift.model';

@ObjectType({ description: 'Сотрудник' })
export class EmployeeModel implements Employee {
  @Field(() => ID)
  id: string;

  @Field(() => String, { description: 'ID персоны' })
  personId: string;

  @Field(() => PersonModel, { description: 'Персона (сотрудник)' })
  person: PersonModel;

  @Field(() => Int, {
    nullable: true,
    description:
      'Коэффициент (процент от работ). null — процент не начисляется',
  })
  ratio: number | null;

  @Field(() => [StaffPositionModel], { description: 'Должности' })
  positions: StaffPositionModel[];

  @Field(() => BigInt, {
    nullable: true,
    description: 'Гарантированный минимум в месяц (копейки)',
  })
  guaranteedMinimumAmount: bigint | null;

  @Field(() => Boolean, {
    description: 'Не показывать в долгах и выдаче зарплаты на главной',
  })
  excludeFromDashboard: boolean;

  @Field(() => Date, { description: 'Дата найма' })
  hiredAt: Date;

  @Field(() => Date, { nullable: true, description: 'Дата увольнения' })
  firedAt: Date | null;

  @Field(() => [EmployeePositionShiftModel], {
    description: 'Циклы графика по должностям, в порядке должностей',
  })
  positionShifts: EmployeePositionShiftModel[];

  @Field(() => String)
  tenantId: string;

  @Field(() => Date, { nullable: true })
  createdAt: Date | null;

  createdBy: string | null;

  @Field(() => Boolean, { description: 'Уволен' })
  isFired: boolean;
}
