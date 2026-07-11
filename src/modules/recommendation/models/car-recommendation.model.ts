import { Field, ID, ObjectType } from '@nestjs/graphql';
import { PartyKind } from 'src/common/party';
import { CounterpartyUnion } from 'src/modules/supplier/supplier.union';
import { PersonModel } from 'src/modules/person/models/person.model';
import { OrganizationModel } from 'src/modules/organization/models/organization.model';
import { CarModel } from 'src/modules/vehicle/models/car.model';
import { CarRecommendationPartModel } from './car-recommendation-part.model';
import { OrderItemServiceKind } from 'src/modules/order/enums/order-item-service-kind.enum';

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

  @Field(() => OrderItemServiceKind, {
    description: 'Вид будущей работы: автосервис или подрядчик',
  })
  kind: OrderItemServiceKind;

  @Field(() => PartyKind, { nullable: true, description: 'Тип диагноста' })
  executorKind: PartyKind | null;

  @Field(() => ID, { nullable: true, description: 'ID диагноста (person)' })
  executorId: string | null;

  @Field(() => CounterpartyUnion, {
    nullable: true,
    description: 'Диагност — кто порекомендовал (всегда персона)',
  })
  executor?: PersonModel | OrganizationModel | null;

  @Field(() => Boolean, {
    description:
      'Диагностика проведена не нами (сторонний сервис / со слов клиента) — диагност пуст',
  })
  externalDiagnostic: boolean;

  @Field(() => PartyKind, {
    nullable: true,
    description: 'Тип будущего исполнителя-подрядчика',
  })
  contractorKind: PartyKind | null;

  @Field(() => ID, {
    nullable: true,
    description: 'ID будущего исполнителя-подрядчика (person|org)',
  })
  contractorId: string | null;

  @Field(() => CounterpartyUnion, {
    nullable: true,
    description: 'Будущий исполнитель-подрядчик (только для kind=CONTRACTOR)',
  })
  contractor?: PersonModel | OrganizationModel | null;

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
