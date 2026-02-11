import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { TenantService } from 'src/common/services/tenant.service';
import { SettingsService } from 'src/modules/settings/settings.service';
import { applyDefaultCurrency } from 'src/common/money';
import { IncomeModel } from './models/income.model';
import { IncomePartModel } from './models/income-part.model';
import { CreateIncomeInput } from './inputs/create-income.input';
import { CreateIncomePartInput } from './inputs/create-income-part.input';
import { UpdateIncomePartInput } from './inputs/update-income-part.input';

const DEFAULT_TAKE = 50;

@Injectable()
export class IncomeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantService: TenantService,
    private readonly settingsService: SettingsService,
  ) {}

  private toIncomeModel(row: {
    id: string;
    supplierId: string;
    document: string | null;
    createdAt: Date | null;
    incomeAccrue: { id: string } | null;
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

  async create(input: CreateIncomeInput): Promise<IncomeModel> {
    const tenantId = await this.tenantService.getTenantId();
    const income = await this.prisma.income.create({
      data: {
        supplierId: input.supplierId,
        document: input.document ?? null,
        tenantId,
      },
      include: {
        incomeAccrue: true,
        incomeParts: { include: { part: true } },
      },
    });
    return this.toIncomeModel(income);
  }

  async findById(id: string): Promise<IncomeModel> {
    const income = await this.prisma.income.findFirst({
      where: { id, tenantId: await this.tenantService.getTenantId() },
      include: {
        incomeAccrue: true,
        incomeParts: { include: { part: true } },
      },
    });
    if (!income) {
      throw new NotFoundException(`Приход не найден: ${id}`);
    }
    return this.toIncomeModel(income);
  }

  async findMany(
    skip = 0,
    take = DEFAULT_TAKE,
    supplierId?: string,
  ): Promise<IncomeModel[]> {
    const tenantId = await this.tenantService.getTenantId();
    const rows = await this.prisma.income.findMany({
      where: {
        tenantId,
        ...(supplierId ? { supplierId } : {}),
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take,
      include: {
        incomeAccrue: true,
        incomeParts: { include: { part: true } },
      },
    });
    return rows.map((r) => this.toIncomeModel(r));
  }

  private async ensureIncomeEditable(id: string): Promise<void> {
    const income = await this.prisma.income.findFirst({
      where: { id, tenantId: await this.tenantService.getTenantId() },
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

  async createIncomePart(input: CreateIncomePartInput): Promise<IncomePartModel> {
    await this.ensureIncomeEditable(input.incomeId);
    const tenantId = await this.tenantService.getTenantId();
    const defaultCurrency =
      await this.settingsService.getDefaultCurrencyCode();
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
      },
      include: { part: true },
    });
    return this.toIncomePartModel(part);
  }

  async updateIncomePart(input: UpdateIncomePartInput): Promise<IncomePartModel> {
    const existing = await this.prisma.incomePart.findFirst({
      where: { id: input.id, tenantId: await this.tenantService.getTenantId() },
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

    const defaultCurrency =
      await this.settingsService.getDefaultCurrencyCode();
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
      include: { part: true },
    });
    return this.toIncomePartModel(updated);
  }

  async deleteIncomePart(id: string): Promise<boolean> {
    const existing = await this.prisma.incomePart.findFirst({
      where: { id, tenantId: await this.tenantService.getTenantId() },
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
}
