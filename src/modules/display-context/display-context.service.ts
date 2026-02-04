import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { TenantService } from 'src/common/services/tenant.service';

/**
 * Сервис контекста для отображения (номер заказа, ФИО, название счёта и т.д.).
 * Использует только Prisma, не зависит от Order/Wallet/Person/CustomerTransaction модулей —
 * позволяет избежать циклических зависимостей при формировании sourceDisplay в проводках.
 */
@Injectable()
export class DisplayContextService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantService: TenantService,
  ) {}

  /** Контекст заказа: «№123 Фамилия Имя» или «№123 Название организации». */
  async getOrderContext(orderId: string): Promise<string> {
    const tenantId = await this.tenantService.getTenantId();
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, tenantId },
      select: {
        number: true,
        customerId: true,
        customer: { select: { lastname: true, firstname: true } },
      },
    });
    if (!order) return '';
    const parts = [`№${order.number}`];
    if (order.customerId) {
      const personName =
        order.customer &&
        [order.customer.lastname, order.customer.firstname]
          .filter(Boolean)
          .join(' ');
      if (personName) {
        parts.push(personName);
      } else {
        const org = await this.prisma.organization.findUnique({
          where: { id: order.customerId },
          select: { name: true },
        });
        if (org?.name) parts.push(org.name);
      }
    }
    return parts.join(', ');
  }

  /** ФИО персоны по id. */
  async getPersonDisplay(personId: string): Promise<string> {
    const person = await this.prisma.person.findUnique({
      where: { id: personId },
      select: { lastname: true, firstname: true },
    });
    if (!person) return '';
    return [person.lastname, person.firstname].filter(Boolean).join(' ');
  }

  /** Название кошелька по id проводки по кошельку (wallet_transaction.id). */
  async getWalletNameByWalletTransactionId(
    walletTransactionId: string,
  ): Promise<string> {
    const tenantId = await this.tenantService.getTenantId();
    const wt = await this.prisma.walletTransaction.findFirst({
      where: { id: walletTransactionId, tenantId },
      select: { wallet: { select: { name: true } } },
    });
    return wt?.wallet?.name ?? '';
  }
}
