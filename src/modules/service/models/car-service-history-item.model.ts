import { Field, ID, ObjectType } from '@nestjs/graphql';
import { MoneyModel } from 'src/common/models/money.model';

@ObjectType()
export class CarServiceHistoryItemModel {
  @Field(() => ID)
  id: string;

  @Field(() => String)
  service: string;

  @Field(() => MoneyModel, { nullable: true })
  price: MoneyModel | null;

  @Field(() => String, { nullable: true })
  executorName: string | null;
}
