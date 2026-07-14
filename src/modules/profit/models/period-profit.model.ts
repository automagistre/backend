import { Field, Int, ObjectType } from '@nestjs/graphql';
import { PeriodProfitSummaryModel } from './period-profit-summary.model';

@ObjectType({ description: 'Прибыль за период (валовая по снапшотам заказов)' })
export class PeriodProfitModel {
  @Field(() => Date)
  dateFrom: Date;

  @Field(() => Date)
  dateTo: Date;

  @Field(() => Date, {
    nullable: true,
    description: 'Граница бэкофилла (MIN income_accrue.created_at)',
  })
  backfillBoundary: Date | null;

  @Field(() => Boolean, {
    description: 'Период начинается раньше границы бэкофилла — данные неполные',
  })
  hasIncompleteHistory: boolean;

  @Field(() => PeriodProfitSummaryModel)
  current: PeriodProfitSummaryModel;

  @Field(() => PeriodProfitSummaryModel, {
    description: 'Тот же интервал календарных дат год назад',
  })
  previousYear: PeriodProfitSummaryModel;
}
