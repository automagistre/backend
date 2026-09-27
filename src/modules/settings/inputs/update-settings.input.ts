import { Field, Float, ID, InputType, Int } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

@InputType({ description: 'Привязка юр. лица к сервису' })
export class TenantOrganizationInput {
  @Field(() => ID)
  @IsUUID()
  organizationId: string;

  @Field(() => Boolean, {
    nullable: true,
    description: 'Основная: печатается по умолчанию',
  })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean | null;
}

@InputType()
export class UpdateSettingsInput {
  @Field(() => String, {
    nullable: true,
    description:
      'Название сервиса. Identifier не меняется: его читает legacy CRM',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  tenantName?: string;

  @Field(() => [TenantOrganizationInput], {
    nullable: true,
    description: 'Юр. лица сервиса целиком: список заменяет текущие привязки',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => TenantOrganizationInput)
  tenantOrganizations?: TenantOrganizationInput[];

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
    description: 'Начало рабочего дня (HH:MM)',
  })
  @IsOptional()
  @IsString()
  @Matches(TIME_PATTERN, {
    message: 'workDayStart должен быть в формате HH:MM',
  })
  workDayStart?: string;

  @Field(() => String, {
    nullable: true,
    description: 'Конец рабочего дня (HH:MM)',
  })
  @IsOptional()
  @IsString()
  @Matches(TIME_PATTERN, { message: 'workDayEnd должен быть в формате HH:MM' })
  workDayEnd?: string;

  @Field(() => Int, {
    nullable: true,
    description: 'Сколько колонок помещается в графике',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(30)
  schedulerMaxStreams?: number;

  @Field(() => String, {
    nullable: true,
    description: 'Часовой пояс тенанта (например Europe/Moscow)',
  })
  @IsOptional()
  @IsString()
  @Length(1, 64)
  timezone?: string;

  @Field(() => Boolean, { nullable: true, description: 'Модуль «Заявки»' })
  @IsOptional()
  @IsBoolean()
  moduleAppealsEnabled?: boolean;

  @Field(() => Boolean, {
    nullable: true,
    description: 'Модуль «Контроль качества»',
  })
  @IsOptional()
  @IsBoolean()
  moduleQualityControlEnabled?: boolean;

  @Field(() => Boolean, { nullable: true, description: 'Модуль «Сайт»' })
  @IsOptional()
  @IsBoolean()
  moduleSiteEnabled?: boolean;

  @Field(() => String, { nullable: true, description: 'Логотип (URL)' })
  @IsOptional()
  @IsString()
  @MaxLength(512)
  brandLogoUrl?: string | null;

  @Field(() => String, { nullable: true, description: 'Сайт' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  brandSite?: string | null;

  @Field(() => String, { nullable: true, description: 'Email для клиентов' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  brandEmail?: string | null;

  @Field(() => [String], {
    nullable: true,
    description: 'Телефоны для клиентов',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5)
  @IsString({ each: true })
  @MaxLength(35, { each: true })
  brandTelephones?: string[] | null;

  @Field(() => String, { nullable: true, description: 'Адрес сервиса' })
  @IsOptional()
  @IsString()
  @MaxLength(512)
  brandServiceAddress?: string | null;

  @Field(() => String, {
    nullable: true,
    description: 'Город в шапке договоров',
  })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  brandContractCity?: string | null;

  @Field(() => String, {
    nullable: true,
    description: 'Страница гарантийных условий (URL)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(512)
  brandGuarantyUrl?: string | null;

  @Field(() => String, {
    nullable: true,
    description: 'Картинка подвала печатных форм (URL)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(512)
  brandPrintFooterImageUrl?: string | null;
}
