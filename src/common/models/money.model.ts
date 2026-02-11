import { Field, ObjectType } from '@nestjs/graphql';

@ObjectType({ description: 'Денежная сумма: минорные единицы и код валюты' })
export class MoneyModel {
  @Field(() => BigInt, {
    description: 'Сумма в минорных единицах (копейки)',
  })
  amountMinor: bigint;

  @Field(() => String, {
    description: 'Код валюты (например RUB)',
  })
  currencyCode: string;
}
