import { Field, ID, Int, ObjectType } from '@nestjs/graphql';
import { Prisma, Wallet } from 'src/generated/prisma/client';

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

  @Field(() => Int, {
    description: 'Налоги в платежах на этот счёт, %. 0 — не применяются',
  })
  taxRatePercent: number;

  @Field(() => Int, {
    description: 'Эквайринг в базисных пунктах, 150 = 1.50%',
  })
  acquiringRateBp: number;

  @Field(() => Date, { nullable: true })
  createdAt: Date | null;

  createdBy: string | null;

  @Field(() => String, { description: 'Баланс' })
  balance: Prisma.Decimal;
}
