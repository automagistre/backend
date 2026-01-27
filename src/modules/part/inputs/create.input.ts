import { Field, ID, InputType, Int } from '@nestjs/graphql';
import { Unit } from '../enums/unit.enum';

@InputType()
export class CreatePartInput {
  @Field(() => ID, { description: 'ID производителя' })
  manufacturerId: string;

  @Field(() => String, { description: 'Название запчасти' })
  name: string;

  @Field(() => String, { description: 'Номер запчасти' })
  number: string;

  @Field(() => Boolean, { description: 'Универсальная запчасть' })
  universal: boolean;

  @Field(() => Unit, { description: 'Единица измерения' })
  unit: Unit;

  @Field(() => ID, { nullable: true, description: 'ID склада' })
  warehouseId?: string;

  @Field(() => BigInt, { nullable: true, description: 'Цена запчасти' })
  price?: bigint | null;

  @Field(() => BigInt, { nullable: true, description: 'Скидка на запчасть' })
  discount?: bigint | null;
}
