import { Field, ID, Int, ObjectType } from '@nestjs/graphql';
import { MotionSourceType } from '../enums/motion-source-type.enum';
import { MotionSourceUnion, MotionSourceType as MotionSourceUnionType } from '../unions/motion-source.union';

@ObjectType({ description: 'Движение запчасти' })
export class MotionModel {
  @Field(() => ID)
  id: string;

  @Field(() => ID, { nullable: true })
  partId: string | null;

  @Field(() => Int, { description: 'Количество (положительное = приход, отрицательное = расход)' })
  quantity: number;

  @Field(() => String, { nullable: true })
  description: string | null;

  @Field(() => MotionSourceType, { description: 'Тип источника движения' })
  sourceType: MotionSourceType;

  @Field(() => ID, { description: 'ID источника (заказ, приход и т.д.)' })
  sourceId: string;

  @Field(() => MotionSourceUnion, { nullable: true, description: 'Источник движения (резолвится автоматически)' })
  source?: MotionSourceUnionType | null;

  @Field(() => Date, { nullable: true })
  createdAt: Date | null;
}
