import { Field, Int, ObjectType } from '@nestjs/graphql';
import { PeriodOrderProfitModel } from './period-order-profit.model';

@ObjectType({ description: 'Страница заказов в отчёте прибыли за период' })
export class PaginatedPeriodOrderProfits {
  @Field(() => [PeriodOrderProfitModel])
  items: PeriodOrderProfitModel[];

  @Field(() => Int)
  total: number;
}
