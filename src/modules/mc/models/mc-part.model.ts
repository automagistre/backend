import { Field, ID, Int, ObjectType } from '@nestjs/graphql';
import { PartModel } from 'src/modules/part/models/part.model';

@ObjectType({ description: 'Запчасть в строке карты ТО' })
export class McPartModel {
  @Field(() => ID)
  id: string;

  @Field(() => PartModel, { description: 'Запчасть' })
  part: PartModel;

  @Field(() => Int)
  quantity: number;

  @Field(() => Boolean)
  recommended: boolean;
}
