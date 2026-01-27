import { Field, ID, Int, ObjectType } from '@nestjs/graphql';
import { Employee } from '@prisma/client';
import { PersonModel } from 'src/modules/person/models/person.model';

@ObjectType({ description: 'Сотрудник' })
export class EmployeeModel implements Employee {
  @Field(() => ID)
  id: string;

  @Field(() => String, { description: 'ID персоны' })
  personId: string;

  @Field(() => PersonModel, { description: 'Персона (сотрудник)' })
  person: PersonModel;

  @Field(() => Int, { description: 'Коэффициент (процент от работ)' })
  ratio: number;

  @Field(() => Date, { description: 'Дата найма' })
  hiredAt: Date;

  @Field(() => Date, { nullable: true, description: 'Дата увольнения' })
  firedAt: Date | null;

  @Field(() => String)
  tenantId: string;

  @Field(() => Date, { nullable: true })
  createdAt: Date | null;

  createdBy: string | null;

  @Field(() => Boolean, { description: 'Уволен' })
  isFired: boolean;
}
