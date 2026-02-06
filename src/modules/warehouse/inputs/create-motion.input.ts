import { Field, ID, InputType, Int } from '@nestjs/graphql';
import { MotionSourceType } from '../enums/motion-source-type.enum';

@InputType()
export class CreateMotionInput {
  @Field(() => ID, { description: 'ID запчасти' })
  partId: string;

  @Field(() => Int, {
    description: 'Количество (может быть положительным или отрицательным)',
  })
  quantity: number;

  @Field(() => MotionSourceType, { description: 'Тип источника движения' })
  sourceType: MotionSourceType;

  @Field(() => ID, { description: 'ID источника движения' })
  sourceId: string;

  @Field(() => String, { nullable: true, description: 'Описание движения' })
  description?: string;
}
