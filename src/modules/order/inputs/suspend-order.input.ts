import { Field, InputType } from '@nestjs/graphql';
import { IsDateString, IsString, IsUUID, MaxLength } from 'class-validator';

@InputType()
export class SuspendOrderInput {
  @IsUUID()
  @Field(() => String, { description: 'ID заказа' })
  orderId: string;

  @IsDateString()
  @Field(() => Date, {
    description: 'Дата, до которой заказ в сне (начало дня = просыпается)',
  })
  till: Date;

  @IsString()
  @MaxLength(255)
  @Field(() => String, { description: 'Причина приостановки' })
  reason: string;
}
