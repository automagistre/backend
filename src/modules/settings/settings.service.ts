import { Injectable } from '@nestjs/common';

/**
 * Настройки приложения. Пока без БД — значения захардкожены.
 * Позже можно заменить на чтение из БД/интерфейса (например defaultCurrency из таблицы настроек по tenant).
 */
@Injectable()
export class SettingsService {
  /**
   * Валюта по умолчанию (например для проводок, цен).
   * Пока захардкожено 'RUB'; позже — из настроек/интерфейса.
   */
  async getDefaultCurrencyCode(): Promise<string> {
    return 'RUB';
  }
}
