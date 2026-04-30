import { Field, Int, ObjectType } from '@nestjs/graphql';

/**
 * Формат денег в legacy CRM Symfony: { amount: int (копейки), currency: 'RUB' }.
 * Сохраняем 1-в-1, чтобы фронт www не пришлось переписывать.
 */
@ObjectType('SiteMoney')
export class WwwMoney {
  @Field(() => Int, { description: 'Сумма в минимальных единицах (копейках)' })
  amount: number;

  @Field(() => String, { description: 'ISO-код валюты, обычно RUB' })
  currency: string;
}
