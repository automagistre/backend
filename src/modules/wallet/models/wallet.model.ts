import { Field, ID, ObjectType } from '@nestjs/graphql';
import { Decimal } from '@prisma/client/runtime/client';
import { Wallet } from 'src/generated/prisma/client';

@ObjectType({ description: 'Кошелёк' })
export class WalletModel implements Wallet {
  @Field(() => ID)
  id: string;

  @Field(() => String, { description: 'Название' })
  name: string;

  @Field(() => Boolean, {
    description: 'Использовать в доходах',
    defaultValue: false,
  })
  useInIncome: boolean;

  @Field(() => Boolean, {
    description: 'Использовать в заказе',
    defaultValue: false,
  })
  useInOrder: boolean;

  @Field(() => Boolean, {
    description: 'Показывать в раскладке',
    defaultValue: false,
  })
  showInLayout: boolean;

  @Field(() => Boolean, {
    description: 'По умолчанию в ручной транзакции',
    defaultValue: false,
  })
  defaultInManualTransaction: boolean;

  @Field(() => String)
  tenantId: string;

  @Field(() => String, { nullable: true, description: 'Код валюты' })
  currencyCode: string | null;

  @Field(() => Date, { nullable: true })
  createdAt: Date | null;

  createdBy: string | null;

  @Field(() => String, { description: 'Баланс' })
  balance: Decimal;
}
