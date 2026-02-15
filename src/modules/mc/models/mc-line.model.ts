import { Field, ID, Int, ObjectType } from '@nestjs/graphql';
import { McWorkModel } from './mc-work.model';
import { McPartModel } from './mc-part.model';

@ObjectType({ description: 'Строка карты ТО (работа + запчасти)' })
export class McLineModel {
  @Field(() => ID)
  id: string;

  @Field(() => McWorkModel, { description: 'Работа' })
  work: McWorkModel;

  @Field(() => Int, { description: 'Период в тыс. км' })
  period: number;

  @Field(() => Boolean)
  recommended: boolean;

  @Field(() => Int)
  position: number;

  @Field(() => [McPartModel])
  parts: McPartModel[];
}
