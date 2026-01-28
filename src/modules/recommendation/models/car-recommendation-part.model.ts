import { Field, ID, Int, ObjectType } from '@nestjs/graphql';
import { PartModel } from 'src/modules/part/models/part.model';

@ObjectType({ description: 'Запчасть в рекомендации по автомобилю' })
export class CarRecommendationPartModel {
  @Field(() => ID)
  id: string;

  @Field(() => ID)
  recommendationId: string;

  @Field(() => PartModel)
  part: PartModel;

  @Field(() => ID)
  partId: string;

  /**
   * Количество хранится в “сыром” формате БД (умножено на 100),
   * чтобы совпадало с логикой заказов/запчастей и единым форматированием на фронте.
   */
  @Field(() => Int)
  quantity: number;

  @Field(() => BigInt, { nullable: true })
  priceAmount: bigint | null;

  @Field(() => String, { nullable: true })
  priceCurrencyCode: string | null;

  @Field(() => Date, { nullable: true })
  createdAt: Date | null;

  @Field(() => ID, { nullable: true })
  createdBy: string | null;
}

