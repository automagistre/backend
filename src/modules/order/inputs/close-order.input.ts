import { Field, InputType, Int } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsOptional,
  IsUUID,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { CloseOrderPaymentItem } from './close-order-payment-item.input';

/** Вход для закрытия заказа (OrderClose + OrderDeal + платежи + перенос предоплат + списание + зарплата). */
@InputType()
export class CloseOrderInput {
  @IsUUID()
  @Field(() => String, { description: 'ID заказа' })
  orderId: string;

  @IsOptional()
  @Min(0)
  @Max(3)
  @Field(() => Int, {
    nullable: true,
    description: 'Удовлетворённость (0–3), по умолчанию 0',
  })
  satisfaction?: number | null;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CloseOrderPaymentItem)
  @Field(() => [CloseOrderPaymentItem], {
    nullable: true,
    description: 'Платежи при закрытии: сколько на какой счёт внесено (без order_payment)',
  })
  payments?: CloseOrderPaymentItem[] | null;
}
