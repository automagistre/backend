import { Field, ID, Int, ObjectType } from '@nestjs/graphql';
import { MoneyModel } from 'src/common/models/money.model';

@ObjectType({ description: 'Запчасть шаблона' })
export class TemplatePartModel {
  @Field(() => ID)
  partId: string;

  @Field(() => String, { nullable: true })
  name: string | null;

  @Field(() => String, { nullable: true })
  number: string | null;

  @Field(() => String, { nullable: true })
  manufacturer: string | null;

  @Field(() => Int)
  quantity: number;

  @Field(() => MoneyModel, { nullable: true })
  price: MoneyModel | null;
}
