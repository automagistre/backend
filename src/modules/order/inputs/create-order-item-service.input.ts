import { Field, ID, InputType } from '@nestjs/graphql';
import { IsOptional } from 'class-validator';
import { MoneyInput } from 'src/common/inputs/money.input';
import { ExecutorInput } from 'src/common/party';
import { OrderItemServiceKind } from '../enums/order-item-service-kind.enum';
import { WarrantyPayerKind } from '../enums/warranty-payer-kind.enum';

@InputType()
export class CreateOrderItemServiceInput {
  @Field(() => ID)
  orderId: string;

  @Field(() => ID, { nullable: true })
  parentId?: string;

  @Field(() => ID, { nullable: true })
  tenantId?: string;

  @Field(() => String)
  service: string;

  @Field(() => OrderItemServiceKind, {
    nullable: true,
    description: 'Вид работы: автосервис (по умолчанию) или подрядчик',
  })
  @IsOptional()
  kind?: OrderItemServiceKind | null;

  @Field(() => ExecutorInput, { nullable: true })
  @IsOptional()
  executor?: ExecutorInput | null;

  // Без defaultValue: PartialType наследует опции поля, и дефолт в Update-инпуте
  // сбрасывал бы гарантию при любом частичном обновлении. Создание подставляет ?? false.
  @Field(() => Boolean, { nullable: true })
  @IsOptional()
  warranty?: boolean;

  @Field(() => WarrantyPayerKind, {
    nullable: true,
    description: 'Кто несёт стоимость гарантийной работы',
  })
  @IsOptional()
  warrantyPayerKind?: WarrantyPayerKind | null;

  @Field(() => ID, {
    nullable: true,
    description: 'person_id сотрудника-плательщика (обязателен при warrantyPayerKind=EMPLOYEE)',
  })
  @IsOptional()
  warrantyPayerPersonId?: string | null;

  @Field(() => MoneyInput, { nullable: true })
  @IsOptional()
  price?: MoneyInput | null;

  @Field(() => MoneyInput, { nullable: true })
  @IsOptional()
  discount?: MoneyInput | null;

  @Field(() => MoneyInput, {
    nullable: true,
    description: 'Себестоимость подрядной работы (только kind=CONTRACTOR)',
  })
  @IsOptional()
  cost?: MoneyInput | null;

  @Field(() => ID, {
    nullable: true,
    description: 'Счёт оплаты подрядчику (обязателен вместе с cost)',
  })
  @IsOptional()
  costWalletId?: string | null;
}
