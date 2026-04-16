import { Field, InputType } from '@nestjs/graphql';
import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { ORDER_CANCEL_REASON_CODES } from '../constants/order-cancel-reasons';

@InputType()
export class CancelOrderInput {
  @IsUUID()
  @Field(() => String, { description: 'ID заказа' })
  orderId: string;

  @IsString()
  @IsIn(ORDER_CANCEL_REASON_CODES)
  @Field(() => String, { description: 'Код причины отмены' })
  reasonCode: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  @Field(() => String, {
    nullable: true,
    description: 'Комментарий причины отмены',
  })
  reasonComment?: string | null;

  @IsOptional()
  @IsBoolean()
  @Field(() => Boolean, {
    nullable: true,
    defaultValue: false,
    description: 'Сохранить работы и запчасти в рекомендации',
  })
  saveToRecommendations?: boolean;

  @IsOptional()
  @IsBoolean()
  @Field(() => Boolean, {
    nullable: true,
    defaultValue: false,
    description: 'Создать заметку клиенту',
  })
  createClientNote?: boolean;
}
