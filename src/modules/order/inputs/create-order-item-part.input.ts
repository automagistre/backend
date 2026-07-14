import { Field, ID, Int, InputType } from '@nestjs/graphql';
import { IsOptional } from 'class-validator';
import { MoneyInput } from 'src/common/inputs/money.input';
import { WarrantyPayerKind } from '../enums/warranty-payer-kind.enum';

@InputType()
export class CreateOrderItemPartInput {
  @Field(() => ID)
  orderId: string;

  @Field(() => ID, { nullable: true })
  parentId?: string;

  @Field(() => ID, { nullable: true })
  tenantId?: string;

  @Field(() => ID)
  partId: string;

  @Field(() => ID, { nullable: true })
  supplierId?: string;

  @Field(() => Int)
  quantity: number;

  // Без defaultValue: PartialType наследует опции поля, и дефолт в Update-инпуте
  // сбрасывал бы гарантию при любом частичном обновлении. Создание подставляет ?? false.
  @Field(() => Boolean, { nullable: true })
  @IsOptional()
  warranty?: boolean;

  @Field(() => WarrantyPayerKind, {
    nullable: true,
    description: 'Кто несёт стоимость гарантийной запчасти',
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
}
