import { Field, ID, Int, ObjectType } from '@nestjs/graphql';
import { ManufacturerModel } from '../../manufacturer/models/manufacturer.model';
import { Unit } from '../enums/unit.enum';
import { Part } from '@prisma/client';
import { PartPriceModel } from './part-price.model';
import { PartDiscountModel } from './part-discount.model';

@ObjectType({ description: 'Запчасть' })
export class PartModel implements Part {
  @Field(() => ID)
  id: string;

  @Field(() => ManufacturerModel)
  manufacturer: ManufacturerModel;

  @Field(() => String)
  name: string;

  manufacturerId: string;

  @Field(() => String)
  number: string;

  @Field(() => Boolean, { defaultValue: false })
  universal: boolean;

  @Field(() => Unit)
  unit: Unit;

  @Field(() => ID, { nullable: true })
  warehouseId: string | null;

  @Field(() => Date, { nullable: true })
  createdAt: Date | null;

  @Field(() => ID, { nullable: true })
  createdBy: string | null;

  @Field(() => PartPriceModel, { nullable: true })
  price?: PartPriceModel | null;

  @Field(() => [PartPriceModel])
  priceHistory?: PartPriceModel[];

  @Field(() => PartDiscountModel, { nullable: true })
  discount?: PartDiscountModel | null;

  @Field(() => [PartDiscountModel])
  discountHistory?: PartDiscountModel[];

  @Field(() => [PartModel])
  crossParts?: PartModel[];

  @Field(() => Int, { nullable: true })
  stockQuantity?: number | null;

  @Field(() => Int, { nullable: true })
  orderFromQuantity?: number | null;

  @Field(() => Int, { nullable: true })
  orderUpToQuantity?: number | null;
}
