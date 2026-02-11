import { Field, Int, ObjectType } from '@nestjs/graphql';
import { ProcurementRowModel } from './procurement-row.model';

@ObjectType()
export class ProcurementTableResult {
  @Field(() => [ProcurementRowModel])
  items: ProcurementRowModel[];

  @Field(() => Int)
  total: number;
}
