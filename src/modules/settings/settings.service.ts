import { Injectable } from '@nestjs/common';
import { SettingsModel } from './settings.model';

/**
 * Настройки приложения. Пока без БД — значения захардкожены.
 * Позже — чтение из БД/интерфейса (таблица настроек по tenant и т.п.).
 */
@Injectable()
export class SettingsService {
  /**
   * Возвращает полный объект настроек. Единая точка для GraphQL и внутреннего использования.
   */
  async getSettings(): Promise<SettingsModel> {
    return {
      defaultCurrencyCode: await this.getDefaultCurrencyCode(),
      minMarkupRatio: await this.getMinMarkupRatio(),
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
}
