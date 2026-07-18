import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from 'src/generated/prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { v6 as uuidv6 } from 'uuid';
import { applyDefaultCurrency } from 'src/common/money';
import type { AuthContext } from 'src/common/user-id.store';
import { SettingsService } from 'src/modules/settings/settings.service';
import { TireSeason } from './enums/tire-season.enum';
import { TireStorageStatus } from './enums/tire-storage-status.enum';
import { CreateTireStorageInput } from './inputs/create-tire-storage.input';
import { UpdateTireStorageInput } from './inputs/update-tire-storage.input';
import { TireStorageModel } from './models/tire-storage.model';

const STORAGE_MONTHS = 8;

export type TireStorageFindManyArgs = {
  take?: number;
  skip?: number;
  customerId?: string;
  orderId?: string;
  status?: TireStorageStatus;
  overdueOnly?: boolean;
  search?: string;
};

@Injectable()
export class TireStorageService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settingsService: SettingsService,
  ) {}

  private toModel(
    row: {
      id: string;
      number: number;
      tenantGroupId: string;
      customerId: string;
      carId: string | null;
      orderId: string | null;
      amountAmount: bigint;
      amountCurrencyCode: string;
      width: number;
      height: number;
      radius: number;
      manufacturer: string;
      quantity: number;
      onDisks: boolean;
      season: string;
      status: string;
      acceptedAt: Date | null;
      expiresAt: Date | null;
      closedAt: Date | null;
      closedById: string | null;
      note: string | null;
      createdAt: Date | null;
      createdBy: string | null;
    },
    now = new Date(),
  ): TireStorageModel {
    const isOverdue =
      (row.status === TireStorageStatus.IN_WAREHOUSE ||
        row.status === TireStorageStatus.AWAITING_SHOP ||
        row.status === TireStorageStatus.IN_SHOP) &&
      row.expiresAt != null &&
      row.expiresAt < now;

    return {
      ...row,
      amount: {
        amountMinor: row.amountAmount,
        currencyCode: row.amountCurrencyCode,
      },
      season: row.season as TireSeason,
      status: row.status as TireStorageStatus,
      isOverdue,
    };
  }

  private async buildWhere(
    ctx: AuthContext,
    args: TireStorageFindManyArgs,
  ): Promise<Prisma.TireStorageWhereInput> {
    const where: Prisma.TireStorageWhereInput = {
      tenantGroupId: ctx.tenantGroupId,
    };

    if (args.customerId) where.customerId = args.customerId;
    if (args.orderId) where.orderId = args.orderId;
    if (args.status) where.status = args.status;

    if (args.overdueOnly) {
      where.status = {
        in: [
          TireStorageStatus.IN_WAREHOUSE,
          TireStorageStatus.AWAITING_SHOP,
          TireStorageStatus.IN_SHOP,
        ],
      };
      where.expiresAt = { lt: new Date() };
    }

    if (args.search?.trim()) {
      const q = args.search.trim();
      const asNumber = Number.parseInt(q, 10);
      const [persons, orgs] = await Promise.all([
        this.prisma.person.findMany({
          where: {
            tenantGroupId: ctx.tenantGroupId,
            OR: [
              { firstname: { contains: q, mode: 'insensitive' } },
              { lastname: { contains: q, mode: 'insensitive' } },
              { telephone: { contains: q, mode: 'insensitive' } },
              { officePhone: { contains: q, mode: 'insensitive' } },
            ],
          },
          select: { id: true },
          take: 100,
        }),
        this.prisma.organization.findMany({
          where: {
            tenantGroupId: ctx.tenantGroupId,
            OR: [
              { name: { contains: q, mode: 'insensitive' } },
              { telephone: { contains: q, mode: 'insensitive' } },
              { officePhone: { contains: q, mode: 'insensitive' } },
            ],
          },
          select: { id: true },
          take: 100,
        }),
      ]);
      const customerIds = [...persons, ...orgs].map((r) => r.id);
      where.OR = [
        ...(customerIds.length ? [{ customerId: { in: customerIds } }] : []),
        { manufacturer: { contains: q, mode: 'insensitive' } },
        { note: { contains: q, mode: 'insensitive' } },
        ...(Number.isFinite(asNumber) && String(asNumber) === q
          ? [{ number: asNumber }]
          : []),
      ];
    }

    return where;
  }

  /** Клиент = person | organization (без FK, как у orders). */
  private async assertCustomerExists(
    ctx: AuthContext,
    customerId: string,
  ): Promise<void> {
    const person = await this.prisma.person.findFirst({
      where: { id: customerId, tenantGroupId: ctx.tenantGroupId },
      select: { id: true },
    });
    if (person) return;
    const org = await this.prisma.organization.findFirst({
      where: { id: customerId, tenantGroupId: ctx.tenantGroupId },
      select: { id: true },
    });
    if (org) return;
    throw new NotFoundException(`Клиент с ID ${customerId} не найден`);
  }

  async findMany(
    ctx: AuthContext,
    args: TireStorageFindManyArgs = {},
  ): Promise<{ items: TireStorageModel[]; total: number }> {
    const take = args.take ?? 25;
    const skip = args.skip ?? 0;
    const where = await this.buildWhere(ctx, args);

    if (take === 0) {
      const total = await this.prisma.tireStorage.count({ where });
      return { items: [], total };
    }

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.tireStorage.findMany({
        where,
        orderBy: [{ number: 'desc' }],
        take,
        skip,
      }),
      this.prisma.tireStorage.count({ where }),
    ]);

    const now = new Date();
    return {
      items: rows.map((row) => this.toModel(row, now)),
      total,
    };
  }

  async findOne(ctx: AuthContext, id: string): Promise<TireStorageModel> {
    const row = await this.prisma.tireStorage.findFirst({
      where: { id, tenantGroupId: ctx.tenantGroupId },
    });
    if (!row) {
      throw new NotFoundException(`Договор хранения с ID ${id} не найден`);
    }
    return this.toModel(row);
  }

  async findEnteredByOrder(
    ctx: AuthContext,
    orderId: string,
  ): Promise<TireStorageModel[]> {
    const rows = await this.prisma.tireStorage.findMany({
      where: {
        tenantGroupId: ctx.tenantGroupId,
        orderId,
        status: TireStorageStatus.ENTERED,
      },
      orderBy: [{ number: 'asc' }],
    });
    return rows.map((row) => this.toModel(row));
  }

  /** Все договоры хранения, введённые/оплаченные в этом заказе (любой статус). */
  async findByOrder(
    ctx: AuthContext,
    orderId: string,
  ): Promise<TireStorageModel[]> {
    const rows = await this.prisma.tireStorage.findMany({
      where: {
        tenantGroupId: ctx.tenantGroupId,
        orderId,
      },
      orderBy: [{ number: 'asc' }],
    });
    return rows.map((row) => this.toModel(row));
  }

  async create(
    ctx: AuthContext,
    input: CreateTireStorageInput,
  ): Promise<TireStorageModel> {
    await this.assertCustomerExists(ctx, input.customerId);

    // Ручное добавление на склад — без заказа (опись). Договор сразу IN_WAREHOUSE.
    const isManual = !input.orderId;

    if (input.orderId) {
      const order = await this.prisma.order.findFirst({
        where: { id: input.orderId, tenantId: ctx.tenantId },
        select: { id: true, customerId: true, close: { select: { id: true } } },
      });
      if (!order) {
        throw new NotFoundException(`Заказ с ID ${input.orderId} не найден`);
      }
      if (order.close) {
        throw new BadRequestException(
          'Нельзя добавить хранение в закрытый заказ',
        );
      }
      if (order.customerId && order.customerId !== input.customerId) {
        throw new BadRequestException(
          'Клиент договора не совпадает с клиентом заказа',
        );
      }
    }

    if (input.carId) {
      const car = await this.prisma.car.findFirst({
        where: { id: input.carId, tenantGroupId: ctx.tenantGroupId },
        select: { id: true },
      });
      if (!car) {
        throw new NotFoundException(`Автомобиль с ID ${input.carId} не найден`);
      }
    }

    const defaultCurrency = await this.settingsService.getDefaultCurrencyCode();
    let amountMinor = 0n;
    let amountCurrencyCode = defaultCurrency;
    if (input.amount) {
      const amount = applyDefaultCurrency(input.amount, defaultCurrency);
      if (amount.amountMinor <= 0n) {
        throw new BadRequestException('Сумма договора должна быть больше нуля');
      }
      amountMinor = amount.amountMinor;
      amountCurrencyCode = amount.currencyCode;
    } else if (!isManual) {
      throw new BadRequestException('Сумма договора обязательна');
    }

    const agg = await this.prisma.tireStorage.aggregate({
      where: { tenantGroupId: ctx.tenantGroupId },
      _max: { number: true },
    });
    // Нумерация с 100 — крупные номера удобны для маркировки на складе
    const nextNumber = Math.max(agg._max.number ?? 0, 99) + 1;

    const now = new Date();
    const acceptedAt =
      isManual && input.acceptedAt ? new Date(input.acceptedAt) : isManual ? now : null;
    const expiresAt = acceptedAt
      ? (() => {
          const d = new Date(acceptedAt);
          d.setMonth(d.getMonth() + STORAGE_MONTHS);
          return d;
        })()
      : null;

    const created = await this.prisma.tireStorage.create({
      data: {
        id: uuidv6(),
        number: nextNumber,
        tenantGroupId: ctx.tenantGroupId,
        customerId: input.customerId,
        carId: input.carId ?? null,
        orderId: input.orderId ?? null,
        amountAmount: amountMinor,
        amountCurrencyCode,
        width: input.width,
        height: input.height,
        radius: input.radius,
        manufacturer: input.manufacturer.trim(),
        quantity: input.quantity ?? 4,
        onDisks: input.onDisks,
        season: input.season,
        status: isManual
          ? TireStorageStatus.IN_WAREHOUSE
          : TireStorageStatus.ENTERED,
        acceptedAt,
        expiresAt,
        note: input.note?.trim() || null,
        createdBy: ctx.userId,
      },
    });

    return this.toModel(created);
  }

  async update(
    ctx: AuthContext,
    input: UpdateTireStorageInput,
  ): Promise<TireStorageModel> {
    const exists = await this.prisma.tireStorage.findFirst({
      where: { id: input.id, tenantGroupId: ctx.tenantGroupId },
    });
    if (!exists) {
      throw new NotFoundException(
        `Договор хранения с ID ${input.id} не найден`,
      );
    }

    const isEntered = exists.status === TireStorageStatus.ENTERED;
    const isManualWarehouse =
      exists.status === TireStorageStatus.IN_WAREHOUSE && exists.orderId == null;

    if (!isEntered && !isManualWarehouse) {
      throw new BadRequestException(
        'Редактировать можно только введённый договор или ручную опись на складе',
      );
    }

    if (input.customerId !== undefined) {
      if (!isManualWarehouse) {
        throw new BadRequestException(
          'Клиента можно менять только у ручной описи на складе',
        );
      }
      if (!input.customerId) {
        throw new BadRequestException('Клиент обязателен');
      }
      await this.assertCustomerExists(ctx, input.customerId);
    }

    if (input.carId) {
      const car = await this.prisma.car.findFirst({
        where: { id: input.carId, tenantGroupId: ctx.tenantGroupId },
        select: { id: true },
      });
      if (!car) {
        throw new NotFoundException(`Автомобиль с ID ${input.carId} не найден`);
      }
    }

    if (input.acceptedAt !== undefined && !isManualWarehouse) {
      throw new BadRequestException(
        'Дату приёмки можно менять только у ручной описи на складе',
      );
    }

    const data: Prisma.TireStorageUpdateInput = {};
    if (input.customerId) {
      data.customerId = input.customerId;
    }
    if (input.carId !== undefined) {
      data.car = input.carId
        ? { connect: { id: input.carId } }
        : { disconnect: true };
    }
    if (input.width != null) data.width = input.width;
    if (input.height != null) data.height = input.height;
    if (input.radius != null) data.radius = input.radius;
    if (input.manufacturer != null) data.manufacturer = input.manufacturer.trim();
    if (input.quantity != null) data.quantity = input.quantity;
    if (input.onDisks != null) data.onDisks = input.onDisks;
    if (input.season != null) data.season = input.season;
    if (input.note !== undefined) data.note = input.note?.trim() || null;

    if (input.acceptedAt !== undefined) {
      const acceptedAt = input.acceptedAt ? new Date(input.acceptedAt) : new Date();
      const expiresAt = new Date(acceptedAt);
      expiresAt.setMonth(expiresAt.getMonth() + STORAGE_MONTHS);
      data.acceptedAt = acceptedAt;
      data.expiresAt = expiresAt;
    }

    if (input.amount) {
      const defaultCurrency =
        await this.settingsService.getDefaultCurrencyCode();
      const amount = applyDefaultCurrency(input.amount, defaultCurrency);
      if (amount.amountMinor < 0n) {
        throw new BadRequestException('Сумма договора не может быть отрицательной');
      }
      if (amount.amountMinor <= 0n && !isManualWarehouse) {
        throw new BadRequestException('Сумма договора должна быть больше нуля');
      }
      data.amountAmount = amount.amountMinor;
      data.amountCurrencyCode = amount.currencyCode;
    }

    const updated = await this.prisma.tireStorage.update({
      where: { id: input.id },
      data,
    });
    return this.toModel(updated);
  }

  async close(ctx: AuthContext, id: string): Promise<TireStorageModel> {
    const exists = await this.prisma.tireStorage.findFirst({
      where: { id, tenantGroupId: ctx.tenantGroupId },
    });
    if (!exists) {
      throw new NotFoundException(`Договор хранения с ID ${id} не найден`);
    }
    if (
      exists.status !== TireStorageStatus.IN_WAREHOUSE &&
      exists.status !== TireStorageStatus.AWAITING_SHOP &&
      exists.status !== TireStorageStatus.IN_SHOP
    ) {
      throw new BadRequestException(
        'Закрыть можно только договор на складе, к выдаче или в цехе',
      );
    }

    const updated = await this.prisma.tireStorage.update({
      where: { id },
      data: {
        status: TireStorageStatus.CLOSED,
        closedAt: new Date(),
        closedById: ctx.userId,
      },
    });
    return this.toModel(updated);
  }

  /** IN_WAREHOUSE → AWAITING_SHOP: клиент заявил комплект к выдаче. */
  async requestShop(ctx: AuthContext, id: string): Promise<TireStorageModel> {
    const exists = await this.prisma.tireStorage.findFirst({
      where: { id, tenantGroupId: ctx.tenantGroupId },
    });
    if (!exists) {
      throw new NotFoundException(`Договор хранения с ID ${id} не найден`);
    }
    if (exists.status !== TireStorageStatus.IN_WAREHOUSE) {
      throw new BadRequestException(
        'Заявить к выдаче можно только договор на складе',
      );
    }

    const updated = await this.prisma.tireStorage.update({
      where: { id },
      data: { status: TireStorageStatus.AWAITING_SHOP },
    });
    return this.toModel(updated);
  }

  /** AWAITING_SHOP → IN_WAREHOUSE: отменить заявку на выдачу. */
  async cancelShopRequest(
    ctx: AuthContext,
    id: string,
  ): Promise<TireStorageModel> {
    const exists = await this.prisma.tireStorage.findFirst({
      where: { id, tenantGroupId: ctx.tenantGroupId },
    });
    if (!exists) {
      throw new NotFoundException(`Договор хранения с ID ${id} не найден`);
    }
    if (exists.status !== TireStorageStatus.AWAITING_SHOP) {
      throw new BadRequestException(
        'Отменить заявку можно только для договора к выдаче',
      );
    }

    const updated = await this.prisma.tireStorage.update({
      where: { id },
      data: { status: TireStorageStatus.IN_WAREHOUSE },
    });
    return this.toModel(updated);
  }

  /** AWAITING_SHOP → IN_SHOP: комплект перемещён в цех, готов к установке. */
  async moveToShop(ctx: AuthContext, id: string): Promise<TireStorageModel> {
    const exists = await this.prisma.tireStorage.findFirst({
      where: { id, tenantGroupId: ctx.tenantGroupId },
    });
    if (!exists) {
      throw new NotFoundException(`Договор хранения с ID ${id} не найден`);
    }
    if (exists.status !== TireStorageStatus.AWAITING_SHOP) {
      throw new BadRequestException(
        'В цех можно переместить только комплект, заявленный к выдаче',
      );
    }

    const updated = await this.prisma.tireStorage.update({
      where: { id },
      data: { status: TireStorageStatus.IN_SHOP },
    });
    return this.toModel(updated);
  }

  /** IN_SHOP → IN_WAREHOUSE: вернуть из цеха на склад. */
  async returnFromShop(
    ctx: AuthContext,
    id: string,
  ): Promise<TireStorageModel> {
    const exists = await this.prisma.tireStorage.findFirst({
      where: { id, tenantGroupId: ctx.tenantGroupId },
    });
    if (!exists) {
      throw new NotFoundException(`Договор хранения с ID ${id} не найден`);
    }
    if (exists.status !== TireStorageStatus.IN_SHOP) {
      throw new BadRequestException(
        'Вернуть на склад можно только комплект, находящийся в цехе',
      );
    }

    const updated = await this.prisma.tireStorage.update({
      where: { id },
      data: { status: TireStorageStatus.IN_WAREHOUSE },
    });
    return this.toModel(updated);
  }

  /** IN_WAREHOUSE | AWAITING_SHOP | IN_SHOP → DISPOSED: утилизация невостребованного комплекта. */
  async dispose(ctx: AuthContext, id: string): Promise<TireStorageModel> {
    const exists = await this.prisma.tireStorage.findFirst({
      where: { id, tenantGroupId: ctx.tenantGroupId },
    });
    if (!exists) {
      throw new NotFoundException(`Договор хранения с ID ${id} не найден`);
    }
    if (
      exists.status !== TireStorageStatus.IN_WAREHOUSE &&
      exists.status !== TireStorageStatus.AWAITING_SHOP &&
      exists.status !== TireStorageStatus.IN_SHOP
    ) {
      throw new BadRequestException(
        'Утилизировать можно только договор на складе, к выдаче или в цехе',
      );
    }

    const updated = await this.prisma.tireStorage.update({
      where: { id },
      data: { status: TireStorageStatus.DISPOSED },
    });
    return this.toModel(updated);
  }

  async remove(ctx: AuthContext, id: string): Promise<boolean> {
    const exists = await this.prisma.tireStorage.findFirst({
      where: { id, tenantGroupId: ctx.tenantGroupId },
    });
    if (!exists) {
      throw new NotFoundException(`Договор хранения с ID ${id} не найден`);
    }
    if (
      exists.status !== TireStorageStatus.ENTERED &&
      !(
        exists.status === TireStorageStatus.IN_WAREHOUSE &&
        exists.orderId == null
      )
    ) {
      throw new BadRequestException(
        'Удалить можно только введённый договор или ошибочную ручную опись на складе',
      );
    }
    await this.prisma.tireStorage.delete({ where: { id } });
    return true;
  }

  /** При закрытии заказа: ENTERED → IN_WAREHOUSE, сроки от даты закрытия. */
  async markInWarehouseForOrder(
    tx: Prisma.TransactionClient,
    ctx: AuthContext,
    orderId: string,
    closedAt: Date,
  ): Promise<{ id: string; amountAmount: bigint; amountCurrencyCode: string }[]> {
    const expiresAt = new Date(closedAt);
    expiresAt.setMonth(expiresAt.getMonth() + STORAGE_MONTHS);

    const entered = await tx.tireStorage.findMany({
      where: {
        tenantGroupId: ctx.tenantGroupId,
        orderId,
        status: TireStorageStatus.ENTERED,
      },
      select: {
        id: true,
        amountAmount: true,
        amountCurrencyCode: true,
      },
    });

    if (entered.length === 0) return [];

    await tx.tireStorage.updateMany({
      where: {
        id: { in: entered.map((row) => row.id) },
      },
      data: {
        status: TireStorageStatus.IN_WAREHOUSE,
        acceptedAt: closedAt,
        expiresAt,
      },
    });

    return entered;
  }

  /** При отмене заказа — удалить только ENTERED-договоры этого заказа. */
  async deleteEnteredForOrder(
    tx: Prisma.TransactionClient,
    ctx: AuthContext,
    orderId: string,
  ): Promise<number> {
    const result = await tx.tireStorage.deleteMany({
      where: {
        tenantGroupId: ctx.tenantGroupId,
        orderId,
        status: TireStorageStatus.ENTERED,
      },
    });
    return result.count;
  }

  /** IN_WAREHOUSE-договоры заказа для снапшота прибыли. */
  async findInWarehouseByOrder(
    tx: Prisma.TransactionClient,
    ctx: AuthContext,
    orderId: string,
  ): Promise<{ id: string; amountAmount: bigint; amountCurrencyCode: string }[]> {
    return tx.tireStorage.findMany({
      where: {
        tenantGroupId: ctx.tenantGroupId,
        orderId,
        status: TireStorageStatus.IN_WAREHOUSE,
      },
      select: {
        id: true,
        amountAmount: true,
        amountCurrencyCode: true,
      },
    });
  }
}
