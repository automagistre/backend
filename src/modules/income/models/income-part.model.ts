import { Field, ID, Int, ObjectType } from '@nestjs/graphql';
import { MoneyModel } from 'src/common/models/money.model';
import { PartModel } from 'src/modules/part/models/part.model';

@ObjectType({ description: 'Позиция прихода' })
export class IncomePartModel {
  @Field(() => ID)
  id: string;

  @Field(() => ID)
  incomeId: string;

  @Field(() => PartModel)
  part: PartModel;

  @Field(() => ID)
  partId: string;

  @Field(() => Int)
  quantity: number;

  @Field(() => MoneyModel, { nullable: true })
  price: MoneyModel | null;
}
