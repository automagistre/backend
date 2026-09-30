import { Field, ID, ObjectType } from '@nestjs/graphql';
import {
  MotivationExclusionReasonEnum,
  MotivationItemTypeEnum,
  MotivationKeepReasonEnum,
  MotivationRowOutcomeEnum,
  MotivationStageEnum,
} from './motivation.enums';

@ObjectType('MotivationBreakdownRow')
export class MotivationBreakdownRowModel {
  @Field(() => MotivationStageEnum)
  stage: MotivationStageEnum;

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
