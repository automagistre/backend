import { Field, ObjectType } from '@nestjs/graphql';

@ObjectType({ description: 'Сводка прибыли по заказу' })
export class OrderProfitModel {
  @Field(() => BigInt)
  revenueAmount: bigint;

  @Field(() => BigInt)
  costAmount: bigint;

  @Field(() => BigInt)
  profitAmount: bigint;

  @Field(() => BigInt)
  worksRevenueAmount: bigint;

  @Field(() => BigInt)
  worksCostAmount: bigint;

  @Field(() => BigInt)
  worksProfitAmount: bigint;

  @Field(() => BigInt)
  partsRevenueAmount: bigint;

  @Field(() => BigInt)
  partsCostAmount: bigint;

  @Field(() => BigInt)
  partsProfitAmount: bigint;

  @Field(() => BigInt, { description: 'Выручка от хранения шин' })
  storageRevenueAmount: bigint;

  @Field(() => BigInt, { description: 'Прибыль от хранения шин' })
  storageProfitAmount: bigint;
}
