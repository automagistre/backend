import { Field, Int, ObjectType } from '@nestjs/graphql';
import { TireStorageModel } from '../models/tire-storage.model';

@ObjectType()
export class PaginatedTireStorages {
  @Field(() => [TireStorageModel])
  items: TireStorageModel[];

  @Field(() => Int)
  total: number;
}
