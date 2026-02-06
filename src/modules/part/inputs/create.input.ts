import { Field, ID, InputType } from '@nestjs/graphql';
import { IsOptional } from 'class-validator';
import { Unit } from '../enums/unit.enum';
import { MoneyInput } from 'src/common/inputs/money.input';

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

  @Field(() => MoneyInput, { nullable: true, description: 'Цена запчасти' })
  @IsOptional()
  price?: MoneyInput | null;

  @Field(() => MoneyInput, { nullable: true, description: 'Скидка на запчасть' })
  @IsOptional()
  discount?: MoneyInput | null;
}
