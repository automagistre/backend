import { Field, Float, InputType, Int } from '@nestjs/graphql';
import {
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
} from 'class-validator';

@InputType()
export class UpdateSettingsInput {
  @Field(() => String, {
    nullable: true,
    description: 'Валюта по умолчанию (например RUB)',
  })
  @IsOptional()
  @IsString()
  @Length(3, 3)
  defaultCurrencyCode?: string;

  @Field(() => Float, {
    nullable: true,
    description: 'Минимальная наценка (коэффициент, например 1.25)',
  })
  @IsOptional()
  @IsNumber(
    { maxDecimalPlaces: 4 },
    { message: 'minMarkupRatio должен быть числом' },
  )
  @Min(0)
  @Max(1000)
  minMarkupRatio?: number;

  @Field(() => Int, {
    nullable: true,
    description: 'Порог задержки поставки в днях',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(3650)
  supplyExpiryDays?: number;

  @Field(() => Int, {
    nullable: true,
    description: 'Через сколько дней после закрытия заказа создавать QC-задачу',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(3650)
  qualityControlDelayDays?: number;

  @Field(() => Int, {
    nullable: true,
    description: 'Час начала рабочего дня для QC-задач (0-23)',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(23)
  qualityControlStartHour?: number;

  @Field(() => String, {
    nullable: true,
    description: 'Часовой пояс тенанта (например Europe/Moscow)',
  })
  @IsOptional()
  @IsString()
  @Length(1, 64)
  timezone?: string;
}
