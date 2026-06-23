import { Field, ID, ObjectType } from '@nestjs/graphql';
import type { CarRecommendation } from 'src/generated/prisma/client';
import { MoneyModel } from 'src/common/models/money.model';

/**
 * Рекомендация для машины клиента (LK). Активные = `expiredAt is null
 * OR expiredAt > now()`. Бэкенд возвращает только активные; поле `expired`
 * оставлено для будущих сценариев («показать просроченные»).
 */
@ObjectType('MeRecommendation')
export class MeRecommendation {
  @Field(() => ID)
  id!: string;

  @Field(() => String, { description: 'Название работы / услуги' })
  service!: string;

  @Field(() => Date, {
    nullable: true,
    description: 'Когда рекомендация теряет актуальность',
  })
  expiredAt!: Date | null;

  @Field(() => Boolean, { description: 'Просрочена ли (expiredAt < now())' })
  expired!: boolean;

  @Field(() => Date, { nullable: true })
  createdAt!: Date | null;

  @Field(() => MoneyModel, {
    nullable: true,
    description: 'Стоимость работы (без запчастей)',
  })
  price!: MoneyModel | null;
}

export function toMeRecommendation(rec: CarRecommendation): MeRecommendation {
  const now = new Date();
  const expired = rec.expiredAt ? rec.expiredAt < now : false;
  return {
    id: rec.id,
    service: rec.service,
    expiredAt: rec.expiredAt ?? null,
    expired,
    createdAt: rec.createdAt ?? null,
    price:
      rec.priceAmount !== null && rec.priceCurrencyCode !== null
        ? {
            amountMinor: rec.priceAmount,
            currencyCode: rec.priceCurrencyCode,
          }
        : null,
  };
}
