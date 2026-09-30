import { Field, ID, Int, ObjectType } from '@nestjs/graphql';
import {
  MotivationBreakdownItemModel,
  MotivationExcludedItemModel,
} from './motivation-breakdown.model';
import { MotivationSchemeModel } from './motivation-scheme.model';
import { OrderMotivationModeEnum } from './motivation.enums';

@ObjectType('MotivationSchemeVersion')
export class MotivationSchemeVersionModel {
  @Field(() => ID)
  id: string;

  @Field(() => Int)
  version: number;

  @Field(() => Date, { description: 'С этого момента схема действует' })
  activeFrom: Date;

  @Field(() => Date)
  createdAt: Date;

  @Field(() => MotivationSchemeModel)
  scheme: MotivationSchemeModel;
}

@ObjectType('OrderMotivationEmployee')
export class OrderMotivationEmployeeModel {
  @Field(() => ID)
  employeeId: string;

  @Field(() => String)
  employeeName: string;

  @Field(() => BigInt, { description: 'Копейки' })
  amount: bigint;
}

@ObjectType('OrderMotivation')
export class OrderMotivationModel {
  @Field(() => ID)
  orderId: string;

  @Field(() => Int)
  orderNumber: number;

  @Field(() => OrderMotivationModeEnum)
  mode: OrderMotivationModeEnum;

  @Field(() => Int, {
    nullable: true,
    description: 'Версия схемы; null — сохранённой схемы нет, взята стартовая',
  })
  schemeVersion: number | null;

  @Field(() => Boolean, {
    description: 'Заказ закрыт без начисления, а схема на дату закрытия есть',
  })
  canCharge: boolean;

  @Field(() => [OrderMotivationEmployeeModel])
  employees: OrderMotivationEmployeeModel[];

  @Field(() => [MotivationBreakdownItemModel])
  items: MotivationBreakdownItemModel[];

  @Field(() => [MotivationExcludedItemModel])
  excluded: MotivationExcludedItemModel[];
}
