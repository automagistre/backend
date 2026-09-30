import { Field, ID, Int, ObjectType } from '@nestjs/graphql';
import {
  MotivationExclusionReasonEnum,
  MotivationItemTypeEnum,
  MotivationKeepReasonEnum,
  MotivationRowOutcomeEnum,
  MotivationStageEnum,
} from './motivation.enums';

@ObjectType('MotivationStageAmount')
export class MotivationStageAmountModel {
  @Field(() => MotivationStageEnum)
  stage: MotivationStageEnum;

  @Field(() => BigInt, { description: 'Копейки' })
  amount: bigint;
}

@ObjectType('MotivationBacktestTotals')
export class MotivationBacktestTotalsModel {
  @Field(() => Int)
  itemsCount: number;

  @Field(() => Int)
  ordersCount: number;

  @Field(() => BigInt, { description: 'Прибыль позиций в расчёте' })
  profit: bigint;

  @Field(() => BigInt)
  fund: bigint;

  @Field(() => BigInt)
  accrued: bigint;

  @Field(() => BigInt, { description: 'Осталось в фонде' })
  keptInFund: bigint;

  @Field(() => BigInt, {
    description: 'Ни один этап позиции не нашёл адресата',
  })
  unattributed: bigint;

  @Field(() => Int)
  excludedWarrantyCount: number;

  @Field(() => BigInt)
  excludedWarrantyProfit: bigint;

  @Field(() => Int)
  excludedBeforeScheduleCount: number;

  @Field(() => BigInt)
  excludedBeforeScheduleProfit: bigint;
}

@ObjectType('MotivationBacktestEmployee')
export class MotivationBacktestEmployeeModel {
  @Field(() => ID)
  employeeId: string;

  @Field(() => String)
  employeeName: string;

  @Field(() => BigInt)
  amount: bigint;

  @Field(() => Int)
  ordersCount: number;

  @Field(() => [MotivationStageAmountModel])
  stages: MotivationStageAmountModel[];
}

@ObjectType('MotivationBacktestType')
export class MotivationBacktestTypeModel {
  @Field(() => MotivationItemTypeEnum)
  type: MotivationItemTypeEnum;

  @Field(() => Int)
  itemsCount: number;

  @Field(() => BigInt)
  profit: bigint;

  @Field(() => BigInt)
  fund: bigint;

  @Field(() => BigInt)
  accrued: bigint;

  @Field(() => BigInt)
  keptInFund: bigint;

  @Field(() => BigInt)
  unattributed: bigint;
}

@ObjectType('MotivationBacktestKept', {
  description: 'Что не начислено: осталось в фонде или без атрибуции',
})
export class MotivationBacktestKeptModel {
  @Field(() => MotivationItemTypeEnum)
  type: MotivationItemTypeEnum;

  @Field(() => MotivationStageEnum, { nullable: true })
  stage: MotivationStageEnum | null;

  @Field(() => MotivationRowOutcomeEnum)
  outcome: MotivationRowOutcomeEnum;

  @Field(() => MotivationKeepReasonEnum, { nullable: true })
  reason: MotivationKeepReasonEnum | null;

  @Field(() => Int)
  itemsCount: number;

  @Field(() => BigInt)
  amount: bigint;
}

@ObjectType('MotivationEmployeeAmount')
export class MotivationEmployeeAmountModel {
  @Field(() => ID)
  employeeId: string;

  @Field(() => BigInt)
  amount: bigint;
}

@ObjectType('MotivationBacktestOrder')
export class MotivationBacktestOrderModel {
  @Field(() => ID)
  orderId: string;

  @Field(() => Int)
  orderNumber: number;

  @Field(() => Date)
  closedAt: Date;

  @Field(() => BigInt)
  profit: bigint;

  @Field(() => BigInt)
  fund: bigint;

  @Field(() => BigInt)
  accrued: bigint;

  @Field(() => BigInt)
  keptInFund: bigint;

  @Field(() => BigInt)
  unattributed: bigint;

  @Field(() => [MotivationEmployeeAmountModel])
  employees: MotivationEmployeeAmountModel[];
}

@ObjectType('MotivationBacktest', {
  description: 'Премия за период по схеме, без записи в БД',
})
export class MotivationBacktestModel {
  @Field(() => Date)
  dateFrom: Date;

  @Field(() => Date)
  dateTo: Date;

  @Field(() => MotivationBacktestTotalsModel)
  totals: MotivationBacktestTotalsModel;

  @Field(() => [MotivationBacktestEmployeeModel])
  employees: MotivationBacktestEmployeeModel[];

  @Field(() => [MotivationBacktestTypeModel])
  types: MotivationBacktestTypeModel[];

  @Field(() => [MotivationBacktestKeptModel])
  kept: MotivationBacktestKeptModel[];

  @Field(() => [MotivationBacktestOrderModel])
  orders: MotivationBacktestOrderModel[];
}

@ObjectType('MotivationBreakdownRow')
export class MotivationBreakdownRowModel {
  @Field(() => MotivationStageEnum, { nullable: true })
  stage: MotivationStageEnum | null;

  @Field(() => ID, { nullable: true })
  employeeId: string | null;

  @Field(() => String, { nullable: true })
  employeeName: string | null;

  @Field(() => ID, { nullable: true })
  positionId: string | null;

  @Field(() => String, { nullable: true })
  positionName: string | null;

  @Field(() => BigInt)
  amount: bigint;

  @Field(() => MotivationRowOutcomeEnum)
  outcome: MotivationRowOutcomeEnum;

  @Field(() => MotivationKeepReasonEnum, { nullable: true })
  reason: MotivationKeepReasonEnum | null;

  @Field(() => String, { nullable: true, description: 'Откуда взят адресат' })
  source: string | null;
}

@ObjectType('MotivationBreakdownItem')
export class MotivationBreakdownItemModel {
  @Field(() => ID)
  itemId: string;

  @Field(() => MotivationItemTypeEnum)
  type: MotivationItemTypeEnum;

  @Field(() => String)
  label: string;

  @Field(() => BigInt)
  profit: bigint;

  @Field(() => BigInt)
  fund: bigint;

  @Field(() => [MotivationBreakdownRowModel])
  rows: MotivationBreakdownRowModel[];
}

@ObjectType('MotivationExcludedItem')
export class MotivationExcludedItemModel {
  @Field(() => ID)
  itemId: string;

  @Field(() => MotivationItemTypeEnum)
  type: MotivationItemTypeEnum;

  @Field(() => String)
  label: string;

  @Field(() => BigInt)
  profit: bigint;

  @Field(() => MotivationExclusionReasonEnum)
  reason: MotivationExclusionReasonEnum;
}

@ObjectType('MotivationOrderBreakdown', {
  description: 'Расшифровка премии по позициям заказа',
})
export class MotivationOrderBreakdownModel {
  @Field(() => ID)
  orderId: string;

  @Field(() => Int)
  orderNumber: number;

  @Field(() => [MotivationBreakdownItemModel])
  items: MotivationBreakdownItemModel[];

  @Field(() => [MotivationExcludedItemModel])
  excluded: MotivationExcludedItemModel[];
}
