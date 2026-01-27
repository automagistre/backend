import { Field, ID, ObjectType } from '@nestjs/graphql';
import { PartDiscount } from 'src/generated/prisma/client';

@ObjectType({ description: 'Скидка на запчасть' })
export class PartDiscountModel implements PartDiscount {
  @Field(() => ID)
  id: string;

  @Field(() => ID, { description: 'ID запчасти' })
  partId: string;

  @Field(() => Date, { description: 'Дата начала действия скидки' })
  since: Date;

  @Field(() => ID, {
    description: 'ID автосервиса',
  })
  tenantId: string;

  @Field(() => BigInt, { nullable: true, description: 'Сумма скидки' })
  discountAmount: bigint | null;

  @Field(() => String, {
    nullable: true,
    defaultValue: 'RUB',
    description: 'Валюта скидки',
  })
  discountCurrencyCode: string | null;

  @Field(() => Date, { nullable: true, description: 'Дата создания' })
  createdAt: Date | null;

  @Field(() => ID, { nullable: true, description: 'Кем создано' })
  createdBy: string | null;
}
