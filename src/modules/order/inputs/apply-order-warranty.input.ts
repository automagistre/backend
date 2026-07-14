import { Field, ID, InputType } from '@nestjs/graphql';

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

  @Field(() => String, {
    nullable: true,
    description:
      'Причина гарантии — обязательна, если warranty=true (сохраняется в Note заказа). ' +
      'Плательщик здесь не выбирается — назначается отдельно по каждой позиции ' +
      '(см. warrantyPayerKind/warrantyPayerPersonId в updateOrderItemService/updateOrderItemPart).',
  })
  reason?: string | null;
}
