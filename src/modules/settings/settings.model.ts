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

  @Field(() => TenantRequisitesModel, {
    nullable: true,
    description: 'Реквизиты Автосервиса',
  })
  tenantRequisites?: TenantRequisitesModel | null;
}
