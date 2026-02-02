import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateWalletTransactionInput } from './inputs/create-wallet-transaction.input';
import { TenantService } from 'src/common/services/tenant.service';
import { WalletService } from './wallet.service';
import { OrderService } from 'src/modules/order/order.service';
import { PersonService } from 'src/modules/person/person.service';
import { WalletTransactionSource } from './enums/wallet-transaction-source.enum';

const DEFAULT_TAKE = 25;
const DEFAULT_SKIP = 0;

@Injectable()
export class WalletTransactionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantService: TenantService,
    private readonly walletService: WalletService,
    private readonly orderService: OrderService,
    private readonly personService: PersonService,
  ) {}

  async create(data: CreateWalletTransactionInput) {
    const tenantId = await this.tenantService.getTenantId();
    const wallet = await this.walletService.findOne(data.walletId);
    if (!wallet) throw new NotFoundException('Счёт не найден');
    return this.prisma.walletTransaction.create({
      data: {
        walletId: data.walletId,
        source: data.source,
        sourceId: data.sourceId,
        description: data.description ?? null,
        amountAmount: data.amountAmount ?? null,
        amountCurrencyCode: data.amountCurrencyCode ?? null,
        tenantId,
      },
      include: { wallet: true },
    });
  }

  async findMany({
    take = DEFAULT_TAKE,
    skip = DEFAULT_SKIP,
    walletId,
  }: {
    take?: number;
    skip?: number;
    walletId?: string;
  }) {
    const tenantId = await this.tenantService.getTenantId();
    const where = {
      tenantId,
      ...(walletId ? { walletId } : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.walletTransaction.findMany({
        where,
        take: +take,
        skip: +skip,
        orderBy: { createdAt: 'desc' },
        include: { wallet: true },
      }),
      this.prisma.walletTransaction.count({ where }),
    ]);
    return { items, total };
  }

  async findOne(id: string) {
    const tenantId = await this.tenantService.getTenantId();
    return this.prisma.walletTransaction.findFirst({
      where: { id, tenantId },
      include: { wallet: true },
    });
  }

  /**
   * Контекстная строка для отображения (номер заказа, ФИО и т.д.).
   * Фронт склеивает с меткой типа источника.
   */
  async getSourceDisplay(source: number, sourceId: string): Promise<string> {
    switch (source as WalletTransactionSource) {
      case WalletTransactionSource.OrderPrepay:
      case WalletTransactionSource.OrderDebit:
        return this.orderService.getDisplayContext(sourceId);
      case WalletTransactionSource.Payroll:
        /** 
         * TODO: Для проводок «Выдача зарплаты» в wallet_transaction.source_id лежит id записи 
         * в customer_transaction, а не person/employee. 
         * В CRM при создании проводки туда пишется $customerTransactionId->toUuid
         * */ 
        return '';
      case WalletTransactionSource.OperandManual: {
        const person = await this.personService.findOne(sourceId);
        if (!person) return '';
        return [person.lastname, person.firstname].filter(Boolean).join(' ');
      }
      case WalletTransactionSource.IncomePayment:
        // TODO: название поставщика
        return '';
      case WalletTransactionSource.Expense:
        // TODO: название статьи расходов
        return '';
      case WalletTransactionSource.Legacy:
      case WalletTransactionSource.Initial:
      default:
        return '';
    }
  }
}
