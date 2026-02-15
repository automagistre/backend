import { Field, Int, ObjectType } from '@nestjs/graphql';
import { McEquipmentModel } from '../models/mc-equipment.model';

@ObjectType()
export class PaginatedMcEquipments {
  @Field(() => [McEquipmentModel])
  items: McEquipmentModel[];

  @Field(() => Int)
  total: number;
}
