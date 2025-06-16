import { Field, ID, Int, ObjectType } from '@nestjs/graphql';
import { PartPrice } from '@prisma/client';

@ObjectType({ description: 'Цена запчасти' })
export class PartPriceModel implements PartPrice {
  @Field(() => ID, { description: 'Уникальный идентификатор' })
  id: string;

  @Field(() => ID, { description: 'ID запчасти' })
  partId: string;

  @Field(() => Date, { description: 'Дата начала действия цены' })
  since: Date;

  @Field(() => ID, {
    description: 'ID тенанта',
    defaultValue: '1ec13d33-3f41-6e3a-a0cb-02420a000f18',
  })
  tenantId: string;

  @Field(() => BigInt, { nullable: true, description: 'Сумма цены' })
  priceAmount: bigint | null;

  @Field(() => String, {
    nullable: true,
    defaultValue: 'RUB',
    description: 'Валюта цены',
  })
  priceCurrencyCode: string | null;

  @Field(() => Date, { nullable: true, description: 'Дата создания' })
  createdAt: Date | null;

  @Field(() => ID, { nullable: true, description: 'Кем создано' })
  createdBy: string | null;
}
