import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { TenantRequisitesModel } from './models/tenant-requisites.model';
import { SettingsModel } from './settings.model';
import { TENANT_REQUISITES_BY_IDENTIFIER } from './tenant-requisites.data';

/**
 * Настройки приложения. Пока без БД — значения захардкожены.
 * Позже — чтение из БД/интерфейса (таблица настроек по tenant и т.п.).
 */
@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Возвращает полный объект настроек. Единая точка для GraphQL и внутреннего использования.
   */
  async getSettings(): Promise<SettingsModel> {
    return {
      defaultCurrencyCode: await this.getDefaultCurrencyCode(),
      minMarkupRatio: await this.getMinMarkupRatio(),
      supplyExpiryDays: await this.getSupplyExpiryDays(),
    };
  }

  /** Валюта по умолчанию (проводки, цены). Пока захардкожено. */
  async getDefaultCurrencyCode(): Promise<string> {
    return 'RUB';
  }

  /** Минимальная наценка (коэффициент, например 1.25 = 25%). */
  async getMinMarkupRatio(): Promise<number> {
    return 1.25;
  }

  /** Порог задержки поставки в днях: updatedAt < now - N дней → задержка. */
  async getSupplyExpiryDays(): Promise<number> {
    return 7;
  }

  /**
   * Реквизиты tenant по ID. Ищет tenant в БД по identifier, маппит на хардкод из CRM.
   * Для demo — возвращает msk. TODO: маппинг tenantId → identifier по UUID при необходимости.
   */
  async getTenantRequisites(tenantId: string): Promise<TenantRequisitesModel | null> {
    const tenant = await this.prisma.tenant.findFirst({
      where: { id: tenantId },
      select: { identifier: true },
    });
    const identifier = tenant?.identifier ?? 'demo';
    const req =
      TENANT_REQUISITES_BY_IDENTIFIER[identifier] ?? TENANT_REQUISITES_BY_IDENTIFIER.demo;
    return req as TenantRequisitesModel;
  }
}
