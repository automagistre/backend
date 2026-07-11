import { Field, ID, ObjectType } from '@nestjs/graphql';
import { PartyKind } from 'src/common/party';
import { CounterpartyUnion } from 'src/modules/supplier/supplier.union';
import { PersonModel } from 'src/modules/person/models/person.model';
import { OrganizationModel } from 'src/modules/organization/models/organization.model';
import { OrderItemServiceKind } from '../enums/order-item-service-kind.enum';
import { WarrantyPayer } from '../enums/warranty-payer.enum';

@ObjectType({ description: 'Услуга в заказе' })
export class OrderItemServiceModel {
  @Field(() => ID)
  id: string;

  @Field(() => String)
  service: string;

  @Field(() => OrderItemServiceKind, {
    description: 'Вид работы: автосервис или подрядчик',
  })
  kind: OrderItemServiceKind;

  @Field(() => PartyKind, { nullable: true, description: 'Тип исполнителя' })
  executorKind: PartyKind | null;

  @Field(() => ID, { nullable: true, description: 'ID исполнителя (person|org)' })
  executorId: string | null;

  @Field(() => CounterpartyUnion, {
    nullable: true,
    description: 'Исполнитель работы (персона или организация)',
  })
  executor?: PersonModel | OrganizationModel | null;

  @Field(() => Boolean)
  warranty: boolean;

  @Field(() => WarrantyPayer, {
    nullable: true,
    description: 'Кто несёт стоимость гарантийной работы',
  })
  warrantyPayer: WarrantyPayer | null;

  @Field(() => BigInt, { nullable: true })
  priceAmount: bigint | null;

  @Field(() => String, { nullable: true })
  priceCurrencyCode: string | null;

  @Field(() => BigInt, { nullable: true })
  discountAmount: bigint | null;

  @Field(() => String, { nullable: true })
  discountCurrencyCode: string | null;

  @Field(() => BigInt, {
    nullable: true,
    description: 'Себестоимость подрядной работы',
  })
  costAmount: bigint | null;

  @Field(() => String, { nullable: true })
  costCurrencyCode: string | null;

  @Field(() => ID, {
    nullable: true,
    description: 'Счёт оплаты подрядчику',
  })
  costWalletId: string | null;

  @Field(() => Date, { nullable: true })
  createdAt: Date | null;

  @Field(() => ID, { nullable: true })
  createdBy: string | null;
}
