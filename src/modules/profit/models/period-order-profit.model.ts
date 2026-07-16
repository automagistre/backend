import { Field, ID, Int, ObjectType } from '@nestjs/graphql';

@ObjectType({ description: 'Прибыль одного заказа в отчёте за период' })
export class PeriodOrderProfitModel {
  @Field(() => ID)
  orderId: string;

  @Field(() => Int)
  orderNumber: number;

  @Field(() => Date)
  closedAt: Date;

  @Field(() => BigInt)
  revenueAmount: bigint;

  @Field(() => BigInt)
  costAmount: bigint;

  @Field(() => BigInt)
  profitAmount: bigint;

  @Field(() => BigInt)
  worksProfitAmount: bigint;

  @Field(() => BigInt)
  partsProfitAmount: bigint;

  @Field(() => BigInt, {
    description: 'Прибыль от хранения шин',
  })
  storageProfitAmount: bigint;

  @Field(() => BigInt)
  partsRevenueAmount: bigint;

  @Field(() => BigInt)
  partsCostAmount: bigint;

  @Field(() => Number, {
    nullable: true,
    description: 'Маржа запчастей, % от выручки (profit/revenue×100)',
  })
  partsMarginPercent: number | null;
}
