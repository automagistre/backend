import { Field, ID, ObjectType } from '@nestjs/graphql';
import { OrganizationModel } from 'src/modules/organization/models/organization.model';
import { PersonModel } from 'src/modules/person/models/person.model';
import { CounterpartyUnion } from 'src/modules/supplier/supplier.union';
import { IncomeAccrueModel } from './income-accrue.model';
import { IncomePartModel } from './income-part.model';

@ObjectType()
export class IncomeModel {
  @Field(() => ID)
  id: string;

  @Field(() => ID)
  supplierId: string;

  @Field(() => CounterpartyUnion, {
    nullable: true,
    description: 'Поставщик (персона или организация)',
  })
  supplier?: PersonModel | OrganizationModel | null;

  @Field(() => String, { nullable: true })
  document?: string | null;

  @Field(() => Date, { nullable: true })
  createdAt?: Date | null;

  @Field(() => Boolean, {
    description: 'True если приход уже оприходован (редактирование запрещено)',
  })
  isAccrued: boolean;

  @Field(() => IncomeAccrueModel, { nullable: true })
  incomeAccrue?: IncomeAccrueModel | null;

  @Field(() => [IncomePartModel], { defaultValue: [] })
  incomeParts: IncomePartModel[];
}
