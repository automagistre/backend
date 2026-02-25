import { Field, ID, InputType } from '@nestjs/graphql';
import { MotionSourceType } from '../enums/motion-source-type.enum';
import { IsUUID } from 'class-validator';

@InputType({ description: 'Фильтр для движений запчастей' })
export class MotionFilterInput {
  @IsUUID()
  @Field(() => ID, { nullable: true, description: 'Фильтр по запчасти' })
  partId?: string;

  @Field(() => MotionSourceType, {
    nullable: true,
    description: 'Фильтр по типу источника',
  })
  sourceType?: MotionSourceType;

  @IsUUID()
  @Field(() => ID, {
    nullable: true,
    description: 'Фильтр по источнику (заказ, приход и т.д.)',
  })
  sourceId?: string;
}
