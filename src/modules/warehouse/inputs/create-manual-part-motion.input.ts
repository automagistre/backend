import { Field, ID, InputType, Int } from '@nestjs/graphql';
import { IsUUID } from 'class-validator';

@InputType({ description: 'Ручная корректировка количества запчасти на складе' })
export class CreateManualPartMotionInput {
  @IsUUID()
  @Field(() => ID, { description: 'ID запчасти' })
  partId: string;

  @Field(() => Int, {
    description:
      'Дельта количества (×100). Положительное — зачисление, отрицательное — списание.',
  })
  quantityDelta: number;

  @Field(() => String, {
    nullable: true,
    description: 'Комментарий к корректировке',
  })
  description?: string | null;
}
