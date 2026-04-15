import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import type { Prisma } from 'src/generated/prisma/client';
import { TenantRequisitesModel } from './models/tenant-requisites.model';
import { SettingsModel } from './settings.model';
import { UpdateSettingsInput } from './inputs/update-settings.input';
import {
  SETTINGS_DEFINITIONS,
  SETTINGS_KEYS,
  SETTING_KEYS_LIST,
  type SettingKey,
  type SettingsValueByKey,
  isSettingKey,
} from './settings.definitions';
import { TENANT_REQUISITES_BY_IDENTIFIER } from './tenant-requisites.data';

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Возвращает полный объект настроек. Единая точка для GraphQL и внутреннего использования.
   */
  async getSettings(tenantId: string): Promise<SettingsModel> {
    const settingsMap = await this.getSettingsMap(tenantId);
    return {
      defaultCurrencyCode: this.resolveSettingValue(
        SETTINGS_KEYS.defaultCurrencyCode,
        settingsMap.get(SETTINGS_KEYS.defaultCurrencyCode),
      ),
      minMarkupRatio: this.resolveSettingValue(
        SETTINGS_KEYS.minMarkupRatio,
        settingsMap.get(SETTINGS_KEYS.minMarkupRatio),
      ),
      supplyExpiryDays: this.resolveSettingValue(
        SETTINGS_KEYS.supplyExpiryDays,
        settingsMap.get(SETTINGS_KEYS.supplyExpiryDays),
      ),
      qualityControlDelayDays: this.resolveSettingValue(
        SETTINGS_KEYS.qualityControlDelayDays,
        settingsMap.get(SETTINGS_KEYS.qualityControlDelayDays),
      ),
      qualityControlStartHour: this.resolveSettingValue(
        SETTINGS_KEYS.qualityControlStartHour,
        settingsMap.get(SETTINGS_KEYS.qualityControlStartHour),
      ),
    };
  }

  /** Валюта по умолчанию (проводки, цены). */
  async getDefaultCurrencyCode(
    tenantId?: string,
    tx?: Prisma.TransactionClient,
  ): Promise<string> {
    if (!tenantId) {
      return SETTINGS_DEFINITIONS[SETTINGS_KEYS.defaultCurrencyCode]
        .defaultValue;
    }
    return this.getSettingValue(
      tenantId,
      SETTINGS_KEYS.defaultCurrencyCode,
      tx,
    );
  }

  /** Минимальная наценка (коэффициент, например 1.25 = 25%). */
  async getMinMarkupRatio(
    tenantId?: string,
    tx?: Prisma.TransactionClient,
  ): Promise<number> {
    if (!tenantId) {
      return SETTINGS_DEFINITIONS[SETTINGS_KEYS.minMarkupRatio].defaultValue;
    }
    return this.getSettingValue(tenantId, SETTINGS_KEYS.minMarkupRatio, tx);
  }

  /** Порог задержки поставки в днях: updatedAt < now - N дней → задержка. */
  async getSupplyExpiryDays(
    tenantId?: string,
    tx?: Prisma.TransactionClient,
  ): Promise<number> {
    if (!tenantId) {
      return SETTINGS_DEFINITIONS[SETTINGS_KEYS.supplyExpiryDays].defaultValue;
    }
    return this.getSettingValue(tenantId, SETTINGS_KEYS.supplyExpiryDays, tx);
  }

  async getQualityControlDelayDays(
    tenantId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<number> {
    return this.getSettingValue(
      tenantId,
      SETTINGS_KEYS.qualityControlDelayDays,
      tx,
    );
  }

  async getQualityControlStartHour(
    tenantId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<number> {
    return this.getSettingValue(
      tenantId,
      SETTINGS_KEYS.qualityControlStartHour,
      tx,
    );
  }

  async updateSettings(
    tenantId: string,
    userId: string,
    input: UpdateSettingsInput,
  ): Promise<SettingsModel> {
    const normalizedPatch = this.normalizePatch(input);
    const entries = Object.entries(normalizedPatch) as Array<
      [SettingKey, Prisma.InputJsonValue]
    >;

    if (entries.length === 0) {
      throw new BadRequestException('Не переданы значения для обновления');
    }

    await this.prisma.$transaction(async (tx) => {
      for (const [key, value] of entries) {
        await tx.setting.upsert({
          where: {
            tenantId_key: { tenantId, key },
          },
          create: {
            tenantId,
            key,
            value,
            createdBy: userId,
          },
          update: {
            value,
          },
        });
      }
    });

    return this.getSettings(tenantId);
  }

  /**
   * Реквизиты tenant по ID. Ищет tenant в БД по identifier, маппит на хардкод из CRM.
   * Для demo — возвращает msk. TODO: маппинг tenantId → identifier по UUID при необходимости.
   */
  async getTenantRequisites(
    tenantId: string,
  ): Promise<TenantRequisitesModel | null> {
    const tenant = await this.prisma.tenant.findFirst({
      where: { id: tenantId },
      select: { identifier: true },
    });
    const identifier = tenant?.identifier ?? 'demo';
    const req =
      TENANT_REQUISITES_BY_IDENTIFIER[identifier] ??
      TENANT_REQUISITES_BY_IDENTIFIER.demo;
    return req as TenantRequisitesModel;
  }

  private async getSettingsMap(
    tenantId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<Map<SettingKey, Prisma.JsonValue>> {
    const client = tx ?? this.prisma;
    const rows = await client.setting.findMany({
      where: {
        tenantId,
        key: {
          in: SETTING_KEYS_LIST,
        },
      },
      select: {
        key: true,
        value: true,
      },
    });

    const map = new Map<SettingKey, Prisma.JsonValue>();
    for (const row of rows) {
      if (!isSettingKey(row.key)) continue;
      map.set(row.key, row.value);
    }
    return map;
  }

  private async getSettingValue<K extends SettingKey>(
    tenantId: string,
    key: K,
    tx?: Prisma.TransactionClient,
  ): Promise<SettingsValueByKey[K]> {
    const client = tx ?? this.prisma;
    const setting = await client.setting.findUnique({
      where: {
        tenantId_key: {
          tenantId,
          key,
        },
      },
      select: {
        value: true,
      },
    });

    return this.resolveSettingValue(key, setting?.value);
  }

  private resolveSettingValue<K extends SettingKey>(
    key: K,
    raw: Prisma.JsonValue | undefined,
  ): SettingsValueByKey[K] {
    const definition = SETTINGS_DEFINITIONS[key];
    if (raw === undefined || raw === null) {
      return definition.defaultValue;
    }
    try {
      return definition.parse(raw);
    } catch {
      return definition.defaultValue;
    }
  }

  private normalizePatch(
    input: UpdateSettingsInput,
  ): Partial<Record<SettingKey, Prisma.InputJsonValue>> {
    const patch: Partial<Record<SettingKey, Prisma.InputJsonValue>> = {};

    if (input.defaultCurrencyCode !== undefined) {
      patch[SETTINGS_KEYS.defaultCurrencyCode] = input.defaultCurrencyCode
        .trim()
        .toUpperCase();
    }
    if (input.minMarkupRatio !== undefined) {
      patch[SETTINGS_KEYS.minMarkupRatio] = input.minMarkupRatio;
    }
    if (input.supplyExpiryDays !== undefined) {
      patch[SETTINGS_KEYS.supplyExpiryDays] = input.supplyExpiryDays;
    }
    if (input.qualityControlDelayDays !== undefined) {
      patch[SETTINGS_KEYS.qualityControlDelayDays] =
        input.qualityControlDelayDays;
    }
    if (input.qualityControlStartHour !== undefined) {
      patch[SETTINGS_KEYS.qualityControlStartHour] =
        input.qualityControlStartHour;
    }

    return patch;
  }
}
