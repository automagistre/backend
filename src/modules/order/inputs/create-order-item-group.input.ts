import { Field, ID, InputType } from '@nestjs/graphql';

@InputType()
export class CreateOrderItemGroupInput {
  @Field(() => ID)
  orderId: string;

  @Field(() => ID, { nullable: true })
  parentId?: string;

  @Field(() => ID, { nullable: true })
  tenantId?: string;

  @Field(() => String)
  name: string;

  // Без defaultValue: PartialType наследует опции поля, и дефолт в Update-инпуте
  // сбрасывал бы флаг при частичном обновлении. Создание подставляет ?? false.
  @Field(() => Boolean, { nullable: true })
  hideParts?: boolean;
}
