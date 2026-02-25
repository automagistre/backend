import { Field, ID, ObjectType } from '@nestjs/graphql';
import { CarModel } from 'src/modules/vehicle/models/car.model';
import { PersonModel } from 'src/modules/person/models/person.model';
import { EmployeeModel } from 'src/modules/employee/models/employee.model';

@ObjectType({ description: 'Информация о заказе в записи календаря' })
export class CalendarEntryOrderInfoModel {
  @Field(() => ID)
  id: string;

  @Field(() => ID, { nullable: true })
  customerId: string | null;

  @Field(() => PersonModel, { nullable: true })
  customer?: PersonModel | null;

  @Field(() => ID, { nullable: true })
  carId: string | null;

  @Field(() => CarModel, { nullable: true })
  car?: CarModel | null;

  @Field(() => ID, {
    nullable: true,
    description: 'ID механика/работника (employee_id)',
  })
  workerId: string | null;

  @Field(() => EmployeeModel, {
    nullable: true,
    description: 'Сотрудник-механик',
  })
  worker?: EmployeeModel | null;

  @Field(() => String, { nullable: true })
  description: string | null;

  @Field(() => Date, { nullable: true })
  createdAt: Date | null;
}
