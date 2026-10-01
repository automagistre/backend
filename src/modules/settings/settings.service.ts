import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import type { Prisma } from 'src/generated/prisma/client';
import type { AuthContext } from 'src/common/user-id.store';
import { AuditLogService } from 'src/modules/audit-log/audit-log.service';
import { AuditEntityType } from 'src/modules/audit-log/enums/audit.enums';
import { SettingsModel } from './settings.model';
import { UpdateSettingsInput } from './inputs/update-settings.input';
import { TenantOrganizationService } from './tenant-organization.service';
import {
  BRAND_TEXT_KEYS,
  SETTINGS_DEFINITIONS,
  SETTINGS_KEYS,
  SETTING_KEYS_LIST,
  type SettingKey,
  type SettingsValueByKey,
  computeWorkDayHours,
  isSettingKey,
} from './settings.definitions';
import {
  timeToMinutes,
  type WorkDayHours,
} from 'src/common/utils/work-day.util';

const TENANT_NAME_MAX_LENGTH = 255;

/** Целые ключи без преобразований: диапазоны проверяет UpdateSettingsInput. */
const PLAIN_INT_KEYS = [
  SETTINGS_KEYS.slotMinutes,
  SETTINGS_KEYS.orderDeleteCoolingHours,
  SETTINGS_KEYS.discountRoundStep,
  SETTINGS_KEYS.tireStorageMonths,
  SETTINGS_KEYS.tireStorageDefaultQuantity,
  SETTINGS_KEYS.taskOverdueHours,
] as const;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** null в патче — значение очищено, строка настройки удаляется и работает умолчание. */
type SettingsPatch = Partial<Record<SettingKey, Prisma.InputJsonValue | null>>;

@Injectable()
export class SettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
    private readonly tenantOrganizations: TenantOrganizationService,
  ) {}

  /**
   * Возвращает полный объект настроек. Единая точка для GraphQL и внутреннего использования.
   */
  async getSettings(tenantId: string): Promise<SettingsModel> {
    const settingsMap = await this.getSettingsMap(tenantId);
    const values = Object.fromEntries(
      SETTING_KEYS_LIST.map((key) => [
        key,
        this.resolveSettingValue(key, settingsMap.get(key)),
      ]),
    ) as SettingsValueByKey;
    return {
      ...values,
      workDayHours: computeWorkDayHours(values.workDayStart, values.workDayEnd),
    };
  }

  async isQualityControlEnabled(
    tenantId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<boolean> {
    return this.getSettingValue(
      tenantId,
      SETTINGS_KEYS.moduleQualityControlEnabled,
      tx,
    );
  }

  /** Модуль «Звонки» доступен, если настроена хотя бы одна активная привязка телефонии. */
  async hasActiveCallRouting(tenantId: string): Promise<boolean> {
    const binding = await this.prisma.callRoutingBinding.findFirst({
      where: { tenantId, isActive: true },
      select: { id: true },
    });
    return binding !== null;
  }

  /** Валюта по умолчанию (проводки, цены). */
  async getDefaultCurrencyCode(
    tenantId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<string> {
    return this.getSettingValue(
      tenantId,
      SETTINGS_KEYS.defaultCurrencyCode,
      tx,
    );
  }

  /** Минимальная наценка (коэффициент, например 1.25 = 25%). */
  async getMinMarkupRatio(
    tenantId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<number> {
    return this.getSettingValue(tenantId, SETTINGS_KEYS.minMarkupRatio, tx);
  }

  /** Порог задержки поставки в днях: updatedAt < now - N дней → задержка. */
  async getSupplyExpiryDays(
    tenantId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<number> {
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

  async getWorkDayStart(
    tenantId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<string> {
    return this.getSettingValue(tenantId, SETTINGS_KEYS.workDayStart, tx);
  }

  async getWorkDayEnd(
    tenantId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<string> {
    return this.getSettingValue(tenantId, SETTINGS_KEYS.workDayEnd, tx);
  }

  /** Длительность рабочего дня в минутах (вычисляется из start/end). */
  async getWorkDayMinutes(
    tenantId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<number> {
    const [start, end] = await Promise.all([
      this.getWorkDayStart(tenantId, tx),
      this.getWorkDayEnd(tenantId, tx),
    ]);
    return Math.max(0, timeToMinutes(end) - timeToMinutes(start));
  }

  async getTimezone(
    tenantId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<string> {
    return this.getSettingValue(tenantId, SETTINGS_KEYS.timezone, tx);
  }

  /** Всё, что нужно для границы рабочего дня (work-day.util). */
  async getWorkDayHours(
    tenantId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<WorkDayHours> {
    const [timezone, workDayStart, workDayEnd] = await Promise.all([
      this.getTimezone(tenantId, tx),
      this.getWorkDayStart(tenantId, tx),
      this.getWorkDayEnd(tenantId, tx),
    ]);
    return { timezone, workDayStart, workDayEnd };
  }

  async getOrderDeleteCoolingHours(tenantId: string): Promise<number> {
    return this.getSettingValue(
      tenantId,
      SETTINGS_KEYS.orderDeleteCoolingHours,
    );
  }

  async getTaskOverdueHours(tenantId: string): Promise<number> {
    return this.getSettingValue(tenantId, SETTINGS_KEYS.taskOverdueHours);
  }

  async getTireStorageMonths(
    tenantId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<number> {
    return this.getSettingValue(tenantId, SETTINGS_KEYS.tireStorageMonths, tx);
  }

  async getTireStorageDefaultQuantity(tenantId: string): Promise<number> {
    return this.getSettingValue(
      tenantId,
      SETTINGS_KEYS.tireStorageDefaultQuantity,
    );
  }

  /**
   * Единственная точка изменения настроек сервиса: ключи настроек, название
   * и юр. лица сохраняются одной транзакцией.
   */
  async updateSettings(
    ctx: AuthContext,
    input: UpdateSettingsInput,
  ): Promise<SettingsModel> {
    const { tenantName, tenantOrganizations, ...settingsInput } = input;
    const entries = Object.entries(this.normalizePatch(settingsInput)) as Array<
      [SettingKey, Prisma.InputJsonValue | null]
    >;
    const name =
      tenantName === undefined
        ? undefined
        : this.normalizeTenantName(tenantName);

    if (
      entries.length === 0 &&
      name === undefined &&
      tenantOrganizations === undefined
    ) {
      throw new BadRequestException('Не переданы значения для обновления');
    }

    await this.prisma.$transaction(async (tx) => {
      for (const [key, value] of entries) {
        if (value === null) {
          await tx.setting.deleteMany({
            where: { tenantId: ctx.tenantId, key },
          });
          continue;
        }
        await tx.setting.upsert({
          where: { tenantId_key: { tenantId: ctx.tenantId, key } },
          create: { tenantId: ctx.tenantId, key, value, createdBy: ctx.userId },
          update: { value },
        });
      }

      if (name === undefined && tenantOrganizations === undefined) return;

      const before = await this.tenantSnapshot(tx, ctx.tenantId);
      if (name !== undefined && name !== before.tenantName) {
        await tx.tenant.updateMany({
          where: { id: ctx.tenantId },
          data: { name, updated_at: new Date() },
        });
      }
      if (tenantOrganizations !== undefined) {
        await this.tenantOrganizations.replace(tx, ctx, tenantOrganizations);
      }
      const after = await this.tenantSnapshot(tx, ctx.tenantId);
      await this.auditLog.record(tx, ctx, {
        rootEntityType: AuditEntityType.TENANT,
        rootEntityId: ctx.tenantId,
        entityType: AuditEntityType.TENANT,
        entityId: ctx.tenantId,
        before: { ...before },
        after: { ...after },
        entityDisplayName: after.tenantName,
      });
    });

    return this.getSettings(ctx.tenantId);
  }

  async getTenantName(tenantId: string): Promise<string> {
    const tenant = await this.prisma.tenant.findFirst({
      where: { id: tenantId },
      select: { name: true },
    });
    if (!tenant) throw new NotFoundException('Тенант не найден');
    return tenant.name;
  }

  private normalizeTenantName(rawName: string): string {
    const name = rawName.trim();
    if (name === '' || name.length > TENANT_NAME_MAX_LENGTH) {
      throw new BadRequestException(
        `Название: от 1 до ${TENANT_NAME_MAX_LENGTH} символов`,
      );
    }
    return name;
  }

  private async tenantSnapshot(tx: Prisma.TransactionClient, tenantId: string) {
    const tenant = await tx.tenant.findFirst({
      where: { id: tenantId },
      select: { name: true },
    });
    if (!tenant) throw new NotFoundException('Тенант не найден');
    return {
      tenantName: tenant.name,
      ...(await this.tenantOrganizations.snapshot(tx, tenantId)),
    };
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
    input: Omit<UpdateSettingsInput, 'tenantName' | 'tenantOrganizations'>,
  ): SettingsPatch {
    const patch: SettingsPatch = {};

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
    if (input.workDayStart !== undefined) {
      patch[SETTINGS_KEYS.workDayStart] = input.workDayStart.trim();
    }
    if (input.workDayEnd !== undefined) {
      patch[SETTINGS_KEYS.workDayEnd] = input.workDayEnd.trim();
    }
    if (input.schedulerMaxStreams !== undefined) {
      patch[SETTINGS_KEYS.schedulerMaxStreams] = input.schedulerMaxStreams;
    }
    if (input.timezone !== undefined) {
      patch[SETTINGS_KEYS.timezone] = input.timezone.trim();
    }
    if (input.moduleAppealsEnabled !== undefined) {
      patch[SETTINGS_KEYS.moduleAppealsEnabled] = input.moduleAppealsEnabled;
    }
    if (input.moduleQualityControlEnabled !== undefined) {
      patch[SETTINGS_KEYS.moduleQualityControlEnabled] =
        input.moduleQualityControlEnabled;
    }
    if (input.moduleSiteEnabled !== undefined) {
      patch[SETTINGS_KEYS.moduleSiteEnabled] = input.moduleSiteEnabled;
    }
    for (const key of PLAIN_INT_KEYS) {
      const value = input[key];
      if (value !== undefined) patch[key] = value;
    }
    for (const key of BRAND_TEXT_KEYS) {
      const value = input[key];
      if (value !== undefined) patch[key] = value?.trim() || null;
    }
    const email = patch[SETTINGS_KEYS.brandEmail];
    if (typeof email === 'string' && !EMAIL_PATTERN.test(email)) {
      throw new BadRequestException('Неверный email');
    }
    if (input.brandTelephones !== undefined) {
      const phones = (input.brandTelephones ?? [])
        .map((phone) => phone.trim())
        .filter(Boolean);
      patch[SETTINGS_KEYS.brandTelephones] = phones.length > 0 ? phones : null;
    }

    return patch;
  }
}
