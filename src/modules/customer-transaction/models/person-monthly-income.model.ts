import { Field, ObjectType } from '@nestjs/graphql';
import { MoneyModel } from 'src/common/models/money.model';

@ObjectType({ description: 'Начисления ЗП и удержания за календарный месяц' })
export class PersonMonthlyIncomeModel {
  @Field(() => Date, { description: 'Первое число месяца' })
  month: Date;

  @Field(() => MoneyModel, {
    description:
      'Начисления ЗП (сдельная с корректировками, бонус с продаж, оклад, премии, доплата до минимума)',
  })
  salaryAmount: MoneyModel;

  @Field(() => MoneyModel, {
    description: 'Удержания (штрафы и гарантийные пенальти)',
  })
  penaltyAmount: MoneyModel;

  @Field(() => MoneyModel, { description: 'Итого: начисления + удержания' })
  netAmount: MoneyModel;
}
