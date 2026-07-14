import { Field, Int, ObjectType } from '@nestjs/graphql';

@ObjectType({ description: 'Сводка валовой прибыли за интервал дат' })
export class PeriodProfitSummaryModel {
  @Field(() => BigInt)
  grossRevenueAmount: bigint;

  @Field(() => BigInt)
  grossCostAmount: bigint;

  @Field(() => BigInt)
  grossProfitAmount: bigint;

  @Field(() => BigInt)
  worksProfitAmount: bigint;

  @Field(() => BigInt)
  partsProfitAmount: bigint;

  @Field(() => BigInt, {
    description: 'Прибыль от подрядных работ (справочно)',
  })
  contractorProfitAmount: bigint;

  @Field(() => Int)
  ordersCount: number;
}
