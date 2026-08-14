import { Field, ObjectType } from '@nestjs/graphql';
import { MoneyModel } from 'src/common/models/money.model';

@ObjectType({ description: 'Начисления ЗП и удержания за календарный месяц' })
export class PersonMonthlyIncomeModel {
  @Field(() => Date, { description: 'Первое число месяца' })
  month: Date;

  @Field(() => MoneyModel, { description: 'Начисления ЗП (заказы, оклад, ручные премии)' })
  salaryAmount: MoneyModel;

  @Field(() => MoneyModel, {
    description: 'Удержания (штрафы и гарантийные пенальти)',
  })
  penaltyAmount: MoneyModel;

  @Field(() => MoneyModel, { description: 'Итого: начисления + удержания' })
  netAmount: MoneyModel;
}
