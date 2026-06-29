import { Field, ID, ObjectType } from '@nestjs/graphql';
import { PartyKind } from 'src/common/party';
import { CounterpartyUnion } from 'src/modules/supplier/supplier.union';
import { PersonModel } from 'src/modules/person/models/person.model';
import { OrganizationModel } from 'src/modules/organization/models/organization.model';
import { CarModel } from 'src/modules/vehicle/models/car.model';
import { CarRecommendationPartModel } from './car-recommendation-part.model';

@ObjectType({
  description: 'Рекомендация по автомобилю (результат диагностики)',
})
export class CarRecommendationModel {
  @Field(() => ID)
  id: string;

  @Field(() => ID, { nullable: true })
  carId: string | null;

  @Field(() => CarModel, { nullable: true })
  car?: CarModel | null;

  @Field(() => String)
  service: string;

  @Field(() => PartyKind, { nullable: true, description: 'Тип исполнителя' })
  executorKind: PartyKind | null;

  @Field(() => ID, { nullable: true, description: 'ID исполнителя (person|org)' })
  executorId: string | null;

  @Field(() => CounterpartyUnion, {
    nullable: true,
    description: 'Диагност/исполнитель рекомендации (персона или организация)',
  })
  executor?: PersonModel | OrganizationModel | null;

  @Field(() => Date, { nullable: true })
  expiredAt: Date | null;

  @Field(() => ID, { nullable: true })
  realization: string | null;

  @Field(() => BigInt, { nullable: true })
  priceAmount: bigint | null;

  @Field(() => String, { nullable: true })
  priceCurrencyCode: string | null;

  @Field(() => [CarRecommendationPartModel])
  parts: CarRecommendationPartModel[];

  @Field(() => Date, { nullable: true })
  createdAt: Date | null;

  @Field(() => ID, { nullable: true })
  createdBy: string | null;
}
