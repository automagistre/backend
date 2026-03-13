import { Field, ObjectType } from '@nestjs/graphql';
import { MoneyModel } from 'src/common/models/money.model';

@ObjectType({ description: 'Работа шаблона' })
export class TemplateWorkModel {
  @Field(() => String)
  name: string;

  @Field(() => MoneyModel, { nullable: true })
  price: MoneyModel | null;
}
