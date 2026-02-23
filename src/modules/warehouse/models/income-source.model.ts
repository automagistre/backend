import { Field, ID, ObjectType } from '@nestjs/graphql';

@ObjectType({ description: 'Источник движения: приход' })
export class IncomeSourceModel {
  @Field(() => ID)
  incomeId: string;

  @Field(() => String, { nullable: true, description: 'Номер документа' })
  document?: string | null;

  @Field(() => ID, { nullable: true })
  supplierId?: string | null;

  @Field(() => String, { nullable: true, description: 'Название поставщика' })
  supplierName?: string | null;
}
