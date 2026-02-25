import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { SettingsService } from 'src/modules/settings/settings.service';
import { applyDefaultCurrency } from 'src/common/money';
import { PartMotionService } from 'src/modules/warehouse/part-motion.service';
import { PartSupplyService } from 'src/modules/warehouse/part-supply.service';
import { MotionSourceType } from 'src/modules/warehouse/enums/motion-source-type.enum';
import { ReservationService } from 'src/modules/reservation/reservation.service';
import { OrderService } from 'src/modules/order/order.service';
import { IncomeModel } from './models/income.model';
import { IncomePartModel } from './models/income-part.model';
import { CreateIncomeInput } from './inputs/create-income.input';
import { CreateIncomePartInput } from './inputs/create-income-part.input';
import { UpdateIncomeInput } from './inputs/update-income.input';
import { UpdateIncomePartInput } from './inputs/update-income-part.input';
import type { AuthContext } from 'src/common/user-id.store';

const DEFAULT_TAKE = 50;

@Injectable()
export class IncomeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settingsService: SettingsService,
    private readonly partMotionService: PartMotionService,
    private readonly partSupplyService: PartSupplyService,
    private readonly reservationService: ReservationService,
    private readonly orderService: OrderService,
  ) {}

  private toIncomeModel(row: {
    id: string;
    supplierId: string;
    document: string | null;
    createdAt: Date | null;
    incomeAccrue: { id: string; createdAt?: Date | null } | null;
    incomeParts: Array<{
      id: string;
      incomeId: string | null;
      partId: string;
      quantity: number;
      priceAmount: bigint | null;
      priceCurrencyCode: string | null;
      part: { id: string };
    }>;
  }): IncomeModel {
    return {
      id: row.id,
      supplierId: row.supplierId,
      document: row.document ?? undefined,
      createdAt: row.createdAt ?? undefined,
      isAccrued: row.incomeAccrue != null,
      incomeAccrue: row.incomeAccrue
        ? { createdAt: row.incomeAccrue.createdAt }
        : null,
      incomeParts: row.incomeParts.map((p) => this.toIncomePartModel(p)),
    };
  }

  private toIncomePartModel(row: {
    id: string;
    incomeId: string | null;
    partId: string;
    quantity: number;
    priceAmount: bigint | null;
    priceCurrencyCode: string | null;
    part: { id: string } & object;
  }): IncomePartModel {
    const price =
      row.priceAmount != null
        ? {
            amountMinor: row.priceAmount,
            currencyCode: row.priceCurrencyCode ?? 'RUB',
          }
        : null;
    return {
      id: row.id,
      incomeId: row.incomeId ?? '',
      partId: row.partId,
      quantity: row.quantity,
      price,
      part: row.part as IncomePartModel['part'],
    };
  }

  async create(
    ctx: AuthContext,
    input: CreateIncomeInput,
  ): Promise<IncomeModel> {
    const { tenantId, userId } = ctx;
    const income = await this.prisma.income.create({
      data: {
        supplierId: input.supplierId,
        document: input.document ?? null,
        tenantId,
        createdBy: userId,
      },
      include: {
        incomeAccrue: true,
        incomeParts: {
          include: { part: { include: { manufacturer: true } } },
        },
      },
    });
    return this.toIncomeModel(income);
  }

  async findById(ctx: AuthContext, id: string): Promise<IncomeModel> {
    const income = await this.prisma.income.findFirst({
      where: { id, tenantId: ctx.tenantId },
      include: {
        incomeAccrue: true,
        incomeParts: {
          include: { part: { include: { manufacturer: true } } },
        },
      },
    });
    if (!income) {
      throw new NotFoundException(`Приход не найден: ${id}`);
    }
    return this.toIncomeModel(income);
  }

  async findMany(
    ctx: AuthContext,
    skip = 0,
    take = DEFAULT_TAKE,
    supplierId?: string,
    partId?: string,
  ): Promise<{ items: IncomeModel[]; total: number }> {
    const { tenantId } = ctx;
    const where: {
      tenantId: string;
      supplierId?: string;
      incomeParts?: { some: { partId: string } };
    } = {
      tenantId,
      ...(supplierId ? { supplierId } : {}),
      ...(partId ? { incomeParts: { some: { partId } } } : {}),
    };
    const [rows, total] = await Promise.all([
      this.prisma.income.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
        include: {
          incomeAccrue: true,
          incomeParts: {
            include: { part: { include: { manufacturer: true } } },
          },
        },
      }),
      this.prisma.income.count({ where }),
    ]);
    return { items: rows.map((r) => this.toIncomeModel(r)), total };
  }

  async update(
    ctx: AuthContext,
    input: UpdateIncomeInput,
  ): Promise<IncomeModel> {
    await this.ensureIncomeEditable(ctx, input.id);
    const income = await this.prisma.income.update({
      where: { id: input.id },
      data: {
        ...(input.document !== undefined && {
          document: input.document ?? null,
        }),
      },
      include: {
        incomeAccrue: true,
        incomeParts: {
          include: { part: { include: { manufacturer: true } } },
        },
      },
    });
    return this.toIncomeModel(income);
  }

  private async ensureIncomeEditable(
    ctx: AuthContext,
    id: string,
  ): Promise<void> {
    const income = await this.prisma.income.findFirst({
      where: { id, tenantId: ctx.tenantId },
      include: { incomeAccrue: true },
    });
    if (!income) {
      throw new NotFoundException(`Приход не найден: ${id}`);
    }
    if (income.incomeAccrue != null) {
      throw new BadRequestException(
        'Редактирование запрещено: приход уже оприходован',
      );
    }
  }

  async createIncomePart(
    ctx: AuthContext,
    input: CreateIncomePartInput,
  ): Promise<IncomePartModel> {
    await this.ensureIncomeEditable(ctx, input.incomeId);
    const { tenantId, userId } = ctx;
    const defaultCurrency = await this.settingsService.getDefaultCurrencyCode();
    const priceData = applyDefaultCurrency(input.price, defaultCurrency);

    if (input.quantity <= 0) {
      throw new BadRequestException('Количество должно быть больше 0');
    }

    const part = await this.prisma.incomePart.create({
      data: {
        incomeId: input.incomeId,
        partId: input.partId,
        quantity: input.quantity,
        priceAmount: priceData.amountMinor,
        priceCurrencyCode: priceData.currencyCode,
        tenantId,
        createdBy: userId,
      },
      include: { part: { include: { manufacturer: true } } },
    });
    return this.toIncomePartModel(part);
  }

  async updateIncomePart(
    ctx: AuthContext,
    input: UpdateIncomePartInput,
  ): Promise<IncomePartModel> {
    const existing = await this.prisma.incomePart.findFirst({
      where: { id: input.id, tenantId: ctx.tenantId },
      include: { income: { include: { incomeAccrue: true } } },
    });
    if (!existing) {
      throw new NotFoundException(`Позиция прихода не найдена: ${input.id}`);
    }
    if (existing.income?.incomeAccrue != null) {
      throw new BadRequestException(
        'Редактирование запрещено: приход уже оприходован',
      );
    }

    const defaultCurrency = await this.settingsService.getDefaultCurrencyCode();
    const updateData: {
      quantity?: number;
      priceAmount?: bigint;
      priceCurrencyCode?: string;
    } = {};

    if (input.quantity !== undefined) {
      if (input.quantity <= 0) {
        throw new BadRequestException('Количество должно быть больше 0');
      }
      updateData.quantity = input.quantity;
    }
    if (input.price != null) {
      const priceData = applyDefaultCurrency(input.price, defaultCurrency);
      updateData.priceAmount = priceData.amountMinor;
      updateData.priceCurrencyCode = priceData.currencyCode;
    }

    const updated = await this.prisma.incomePart.update({
      where: { id: input.id },
      data: updateData,
      include: { part: { include: { manufacturer: true } } },
    });
    return this.toIncomePartModel(updated);
  }

  async deleteIncomePart(ctx: AuthContext, id: string): Promise<boolean> {
    const existing = await this.prisma.incomePart.findFirst({
      where: { id, tenantId: ctx.tenantId },
      include: { income: { include: { incomeAccrue: true } } },
    });
    if (!existing) {
      throw new NotFoundException(`Позиция прихода не найдена: ${id}`);
    }
    if (existing.income?.incomeAccrue != null) {
      throw new BadRequestException(
        'Удаление запрещено: приход уже оприходован',
      );
    }

    await this.prisma.incomePart.delete({ where: { id } });
    return true;
  }

  async deleteIncome(ctx: AuthContext, id: string): Promise<boolean> {
    const income = await this.prisma.income.findFirst({
      where: { id, tenantId: ctx.tenantId },
      include: { incomeAccrue: true },
    });
    if (!income) {
      throw new NotFoundException(`Приход не найден: ${id}`);
    }
    if (income.incomeAccrue != null) {
      throw new BadRequestException(
        'Удаление запрещено: приход уже оприходован',
      );
    }
    await this.prisma.incomePart.deleteMany({ where: { incomeId: id } });
    await this.prisma.income.delete({ where: { id } });
    return true;
  }

  async accrue(ctx: AuthContext, incomeId: string): Promise<IncomeModel> {
    const { tenantId } = ctx;
    const income = await this.prisma.income.findFirst({
      where: { id: incomeId, tenantId },
      include: {
        incomeAccrue: true,
        incomeParts: {
          include: { part: { include: { manufacturer: true } } },
        },
      },
    });
    if (!income) {
      throw new NotFoundException(`Приход не найден: ${incomeId}`);
    }
    if (income.incomeAccrue != null) {
      throw new BadRequestException('Приход уже оприходован');
    }
    if (income.incomeParts.length === 0) {
      throw new BadRequestException('Нельзя оприходовать приход без позиций');
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.incomeAccrue.create({
        data: { incomeId, tenantId, createdBy: ctx.userId },
      });

      const supplierId = income.supplierId;
      for (const ip of income.incomeParts) {
        await this.partMotionService.createWithinTransaction(
          tx,
          {
            partId: ip.partId,
            quantity: ip.quantity,
            sourceType: MotionSourceType.INCOME,
            sourceId: incomeId,
          },
          tenantId,
          ctx.userId,
        );
        await this.partSupplyService.decreaseSupplyForIncome(
          tx,
          ip.partId,
          supplierId,
          ip.quantity,
          incomeId,
          tenantId,
          ctx.userId,
        );
      }

      const partIds = [...new Set(income.incomeParts.map((ip) => ip.partId))];
      const allOrderIds = new Set<string>();
      for (const partId of partIds) {
        const qty = income.incomeParts
          .filter((p) => p.partId === partId)
          .reduce((s, p) => s + p.quantity, 0);
        const orderIds = await this.reservationService.reserveAccruedForPart(
          tx,
          partId,
          qty,
          tenantId,
          ctx.userId,
        );
        orderIds.forEach((oid) => allOrderIds.add(oid));
      }
      for (const orderId of allOrderIds) {
        await this.orderService.trySetNotificationIfFullyReserved(tx, orderId);
      }

      const updated = await tx.income.findUniqueOrThrow({
        where: { id: incomeId },
        include: {
          incomeAccrue: true,
          incomeParts: {
            include: { part: { include: { manufacturer: true } } },
          },
        },
      });
      return this.toIncomeModel(updated);
    });
  }
}
