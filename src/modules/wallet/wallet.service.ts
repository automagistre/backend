import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  CreateWalletInput,
  UpdateWalletInput,
} from './inputs/wallet.input';
import { TenantService } from 'src/common/services/tenant.service';

const DEFAULT_TAKE = 25;
const DEFAULT_SKIP = 0;

@Injectable()
export class WalletService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantService: TenantService,
  ) {}

  async create(data: CreateWalletInput) {
    const tenantId = await this.tenantService.getTenantId();
    return this.prisma.wallet.create({
      data: {
        name: data.name,
        useInIncome: data.useInIncome ?? false,
        useInOrder: data.useInOrder ?? false,
        showInLayout: data.showInLayout ?? false,
        defaultInManualTransaction: data.defaultInManualTransaction ?? false,
        currencyCode: data.currencyCode ?? 'RUB',
        tenantId,
      },
    });
  }

  async update({ id, ...data }: UpdateWalletInput) {
    const wallet = await this.findOne(id);
    if (!wallet) throw new NotFoundException('Счёт не найден');
    const updateData = Object.fromEntries(
      Object.entries(data).filter(([_, value]) => value !== undefined),
    );
    return this.prisma.wallet.update({
      where: { id },
      data: updateData,
    });
  }

  async findMany({
    take = DEFAULT_TAKE,
    skip = DEFAULT_SKIP,
    search,
  }: {
    take?: number;
    skip?: number;
    search?: string;
  }) {
    const tenantId = await this.tenantService.getTenantId();
    const where = {
      tenantId,
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

  async findOne(id: string) {
    const tenantId = await this.tenantService.getTenantId();
    return this.prisma.wallet.findFirst({
      where: { id, tenantId },
    });
  }

  async remove(id: string) {
    const wallet = await this.findOne(id);
    if (!wallet) throw new NotFoundException('Кошелёк не найден');
    const transactionsCount = await this.prisma.walletTransaction.count({
      where: { walletId: id },
    });
    if (transactionsCount > 0) {
      throw new BadRequestException(
        'Нельзя удалить кошелёк с проводками',
      );
    }
    return this.prisma.wallet.delete({
      where: { id },
    });
  }
}
