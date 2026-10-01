import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateWalletInput, UpdateWalletInput } from './inputs/wallet.input';
import { SettingsService } from 'src/modules/settings/settings.service';
import type { AuthContext } from 'src/common/user-id.store';

const DEFAULT_TAKE = 25;
const DEFAULT_SKIP = 0;

function assertRate(
  value: number | null | undefined,
  max: number,
  message: string,
): void {
  if (value == null) return;
  if (!Number.isInteger(value) || value < 0 || value > max) {
    throw new BadRequestException(message);
  }
}

@Injectable()
export class WalletService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settingsService: SettingsService,
  ) {}

  async create(ctx: AuthContext, data: CreateWalletInput) {
    assertRate(data.taxRatePercent, 50, 'Налоги — целое число от 0 до 50');
    assertRate(data.acquiringRateBp, 10_000, 'Эквайринг — от 0 до 100%');
    const defaultCurrency = await this.settingsService.getDefaultCurrencyCode(
      ctx.tenantId,
    );
    return this.prisma.wallet.create({
      data: {
        name: data.name,
        useInIncome: data.useInIncome ?? false,
        useInOrder: data.useInOrder ?? false,
        showInLayout: data.showInLayout ?? false,
        defaultInManualTransaction: data.defaultInManualTransaction ?? false,
        currencyCode: data.currencyCode ?? defaultCurrency,
        taxRatePercent: data.taxRatePercent ?? 0,
        acquiringRateBp: data.acquiringRateBp ?? 0,
        tenantId: ctx.tenantId,
        createdBy: ctx.userId,
      },
    });
  }

  async update(ctx: AuthContext, { id, ...data }: UpdateWalletInput) {
    const wallet = await this.findOne(ctx, id);
    if (!wallet) throw new NotFoundException('Счёт не найден');
    assertRate(data.taxRatePercent, 50, 'Налоги — целое число от 0 до 50');
    assertRate(data.acquiringRateBp, 10_000, 'Эквайринг — от 0 до 100%');
    const { taxRatePercent, acquiringRateBp, ...rest } = data;
    const updateData = {
      ...Object.fromEntries(
        Object.entries(rest).filter(([, value]) => value !== undefined),
      ),
      ...(taxRatePercent != null ? { taxRatePercent } : {}),
      ...(acquiringRateBp != null ? { acquiringRateBp } : {}),
    };
    return this.prisma.wallet.update({
      where: { id },
      data: updateData,
    });
  }

  async findMany(
    ctx: AuthContext,
    {
      take = DEFAULT_TAKE,
      skip = DEFAULT_SKIP,
      search,
    }: {
      take?: number;
      skip?: number;
      search?: string;
    },
  ) {
    const where = {
      tenantId: ctx.tenantId,
      ...(search
        ? { name: { contains: search, mode: 'insensitive' as const } }
        : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.wallet.findMany({
        where,
        take: +take,
        skip: +skip,
        orderBy: { name: 'asc' },
      }),
      this.prisma.wallet.count({ where }),
    ]);
    return { items, total };
  }

  async findOne(ctx: AuthContext, id: string) {
    return this.prisma.wallet.findFirst({
      where: { id, tenantId: ctx.tenantId },
    });
  }

  async remove(ctx: AuthContext, id: string) {
    const wallet = await this.findOne(ctx, id);
    if (!wallet) throw new NotFoundException('Кошелёк не найден');
    const transactionsCount = await this.prisma.walletTransaction.count({
      where: { walletId: id },
    });
    if (transactionsCount > 0) {
      throw new BadRequestException('Нельзя удалить кошелёк с проводками');
    }
    return this.prisma.wallet.delete({
      where: { id },
    });
  }
}
