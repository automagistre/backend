import { Field, Float, ID, InputType } from '@nestjs/graphql';

@InputType()
export class CreateWalletInput {
  @Field(() => String, { description: 'Название' })
  name: string;

  @Field(() => Boolean, {
    description: 'Использовать в доходах',
    defaultValue: true,
  })
  useInIncome: boolean;

  @Field(() => Boolean, {
    description: 'Использовать в заказе',
    defaultValue: true,
  })
  useInOrder: boolean;

  @Field(() => Boolean, {
    description: 'Показывать в раскладке',
    defaultValue: true,
  })
  showInLayout: boolean;

  @Field(() => Boolean, {
    description: 'По умолчанию в ручной транзакции',
    defaultValue: false,
  })
  defaultInManualTransaction: boolean;

  @Field(() => String, { nullable: true, description: 'Код валюты' })
  currencyCode?: string | null;
}

@InputType()
export class UpdateWalletInput {
  @Field(() => ID, { description: 'ID кошелька' })
  id: string;

  @Field(() => String, { nullable: true, description: 'Название' })
  name?: string;

  @Field(() => Boolean, {
    nullable: true,
    description: 'Использовать в доходах',
  })
  useInIncome?: boolean;

  @Field(() => Boolean, {
    nullable: true,
    description: 'Использовать в заказе',
  })
  useInOrder?: boolean;

  @Field(() => Boolean, {
    nullable: true,
    description: 'Показывать в раскладке',
  })
  showInLayout?: boolean;

  @Field(() => Boolean, {
    nullable: true,
    description: 'По умолчанию в ручной транзакции',
  })
  defaultInManualTransaction?: boolean;

  @Field(() => String, { nullable: true, description: 'Код валюты' })
  currencyCode?: string | null;
}
