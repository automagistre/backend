import { Field, Float, Int, ObjectType } from '@nestjs/graphql';
import { TenantRequisitesModel } from './models/tenant-requisites.model';

@ObjectType({ description: 'Настройки приложения (tenant-scoped в будущем)' })
export class SettingsModel {
  @Field(() => String, {
    description: 'Валюта по умолчанию (например для проводок, цен)',
  })
  defaultCurrencyCode: string;

  @Field(() => Float, {
    description: 'Минимальная наценка (коэффициент, например 1.25 = 25%)',
  })
  minMarkupRatio: number;

  @Field(() => Int, {
    description:
      'Порог задержки поставки в днях: если updatedAt поставки старше — считать «задержка»',
  })
  supplyExpiryDays: number;

  @Field(() => Int, {
    description:
      'Через сколько дней после закрытия заказа задача контроля качества попадает на доску',
  })
  qualityControlDelayDays: number;

  @Field(() => Int, {
    description: 'Час начала рабочего дня для планирования QC-задач (0-23)',
  })
  qualityControlStartHour: number;

  @Field(() => String, {
    description: 'Начало рабочего дня (HH:MM)',
  })
  workDayStart: string;

  @Field(() => String, {
    description: 'Конец рабочего дня (HH:MM)',
  })
  workDayEnd: string;

  @Field(() => Float, {
    description:
      'Длина рабочего дня в часах — вычисляется из workDayStart/workDayEnd',
  })
  workDayHours: number;

  @Field(() => Int, {
    description:
      'Сколько колонок помещается в графике: людей в смене может быть больше, чем подъёмников',
  })
  schedulerMaxStreams: number;

  @Field(() => String, {
    description: 'Часовой пояс тенанта (например Europe/Moscow)',
  })
  timezone: string;

  @Field(() => Boolean, {
    description: 'Модуль «Заявки»: показывать в навигации',
  })
  moduleAppealsEnabled: boolean;

  @Field(() => Boolean, {
    description:
      'Модуль «Контроль качества»: создание задач при закрытии заказа и доска задач',
  })
  moduleQualityControlEnabled: boolean;

  @Field(() => Boolean, {
    description: 'Модуль «Сайт»: показывать в навигации',
  })
  moduleSiteEnabled: boolean;

  @Field(() => String, { nullable: true, description: 'Логотип (URL)' })
  brandLogoUrl: string | null;

  @Field(() => String, { nullable: true, description: 'Сайт' })
  brandSite: string | null;

  @Field(() => String, { nullable: true, description: 'Email для клиентов' })
  brandEmail: string | null;

  @Field(() => [String], { description: 'Телефоны для клиентов' })
  brandTelephones: string[];

  @Field(() => String, {
    nullable: true,
    description: 'Адрес сервиса (место оказания услуг и хранения)',
  })
  brandServiceAddress: string | null;

  @Field(() => String, {
    nullable: true,
    description: 'Город в шапке договоров, например «г. Москва»',
  })
  brandContractCity: string | null;

  @Field(() => String, {
    nullable: true,
    description: 'Страница гарантийных условий (URL, печатается QR-кодом)',
  })
  brandGuarantyUrl: string | null;

  @Field(() => String, {
    nullable: true,
    description: 'Картинка подвала печатных форм (URL)',
  })
  brandPrintFooterImageUrl: string | null;

  @Field(() => Boolean, {
    description:
      'Есть активная привязка телефонии (UIS): модуль «Звонки» доступен',
  })
  callsConfigured?: boolean;

  @Field(() => String, { description: 'Название сервиса (тенанта)' })
  tenantName?: string;

  tenantRequisites?: TenantRequisitesModel | null;
}
