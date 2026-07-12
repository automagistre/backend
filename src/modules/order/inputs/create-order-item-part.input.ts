import { Field, ID, Int, InputType } from '@nestjs/graphql';
import { IsOptional } from 'class-validator';
import { MoneyInput } from 'src/common/inputs/money.input';
import { WarrantyPayer } from '../enums/warranty-payer.enum';

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

  @Field(() => WarrantyPayer, {
    nullable: true,
    description: 'Кто несёт стоимость гарантийной запчасти',
  })
  @IsOptional()
  warrantyPayer?: WarrantyPayer | null;

  @Field(() => MoneyInput, { nullable: true })
  @IsOptional()
  price?: MoneyInput | null;

  @Field(() => MoneyInput, { nullable: true })
  @IsOptional()
  discount?: MoneyInput | null;
}
