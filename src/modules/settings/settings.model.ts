import { Field, Float, ObjectType } from '@nestjs/graphql';

@ObjectType({ description: 'Глобальные настройки приложения' })
export class SettingsModel {
  @Field(() => String, {
    description: 'Валюта по умолчанию (например для проводок, цен)',
  })
  defaultCurrencyCode: string;

  @Field(() => Float, {
    description: 'Минимальная наценка (коэффициент, например 1.25 = 25%)',
  })
  minMarkupRatio: number;
}
