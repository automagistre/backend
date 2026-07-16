import { Field, ID, ObjectType } from '@nestjs/graphql';
import { ProfitCostBasis } from '../enums/profit-cost-basis.enum';
import { ProfitLineKind } from '../enums/profit-line-kind.enum';
import { ProfitOrigin } from '../enums/profit-origin.enum';
import { WarrantyPayerKind } from 'src/modules/order/enums/warranty-payer-kind.enum';

@ObjectType({ description: 'Снапшот прибыли по позиции заказа' })
export class OrderItemProfitModel {
  @Field(() => ID)
  id: string;

  @Field(() => ID, { nullable: true })
  orderItemId: string | null;

  @Field(() => ID, {
    nullable: true,
    description: 'Договор хранения (для kind=STORAGE)',
  })
  storageId: string | null;

  @Field(() => ID)
  orderId: string;

  @Field(() => ProfitLineKind)
  kind: ProfitLineKind;

  @Field(() => BigInt, { description: 'Выручка в копейках' })
  revenueAmount: bigint;

  @Field(() => BigInt, { description: 'Себестоимость в копейках' })
  costAmount: bigint;

  @Field(() => BigInt, { description: 'Прибыль в копейках' })
  profitAmount: bigint;

  @Field(() => String)
  currencyCode: string;

  @Field(() => ProfitCostBasis)
  costBasis: ProfitCostBasis;

  @Field(() => ProfitOrigin)
  origin: ProfitOrigin;

  @Field(() => Boolean)
  warranty: boolean;

  @Field(() => WarrantyPayerKind, { nullable: true })
  warrantyPayerKind: WarrantyPayerKind | null;

  @Field(() => Date)
  closedAt: Date;

  @Field(() => Date, { nullable: true })
  createdAt: Date | null;
}
