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

  @Field(() => TenantRequisitesModel, {
    nullable: true,
    description: 'Реквизиты Автосервиса',
  })
  tenantRequisites?: TenantRequisitesModel | null;
}
