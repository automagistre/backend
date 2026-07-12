import { Field, ID, InputType } from '@nestjs/graphql';
import { WarrantyPayer } from '../enums/warranty-payer.enum';

@InputType()
export class ApplyOrderWarrantyInput {
  @Field(() => ID)
  orderId: string;

  @Field(() => [ID], { description: 'ID выделенных позиций заказа (order_item.id)' })
  itemIds: string[];

  @Field(() => Boolean, {
    description: 'true — пометить как гарантийные, false — снять пометку',
  })
  warranty: boolean;

  @Field(() => WarrantyPayer, {
    nullable: true,
    description: 'Плательщик за выделенные работы (обязателен, если warranty=true и есть работы)',
  })
  workPayer?: WarrantyPayer | null;

  @Field(() => WarrantyPayer, {
    nullable: true,
    description:
      'Плательщик за выделенные запчасти (обязателен, если warranty=true и есть запчасти)',
  })
  partsPayer?: WarrantyPayer | null;

  @Field(() => String, {
    nullable: true,
    description: 'Причина гарантии — обязательна, если warranty=true (сохраняется в Note заказа)',
  })
  reason?: string | null;
}
