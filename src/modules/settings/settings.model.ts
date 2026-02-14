import { Field, Float, Int, ObjectType } from '@nestjs/graphql';

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

  @Field(() => Int, {
    description: 'Порог задержки поставки в днях: если updatedAt поставки старше — считать «задержка»',
  })
  supplyExpiryDays: number;
}
