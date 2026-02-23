import { Field, Int, ObjectType } from '@nestjs/graphql';
import { MotionModel } from '../models/motion.model';

@ObjectType({ description: 'Движения с пагинацией' })
export class PaginatedMotions {
  @Field(() => [MotionModel])
  items: MotionModel[];

  @Field(() => Int)
  total: number;
}
