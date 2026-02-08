import { Field, Int, ObjectType } from '@nestjs/graphql';
import { AppealModel } from '../models/appeal.model';

@ObjectType()
export class PaginatedAppeals {
  @Field(() => [AppealModel])
  items: AppealModel[];

  @Field(() => Int)
  total: number;
}
