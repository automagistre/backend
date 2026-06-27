import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import type { AuthContext } from 'src/common/user-id.store';

/**
 * Сервис контекста для отображения (номер заказа, ФИО, название счёта и т.д.).
 * Использует только Prisma, не зависит от Order/Wallet/Person/CustomerTransaction модулей —
 * позволяет избежать циклических зависимостей при формировании sourceDisplay в проводках.
 *
 * TODO: Постепенно заменять использование этого сервиса на GraphQL Union Types + DataLoader + ResolveField,
 * как реализовано для Motion.source в MotionSourceLoader/MotionResolver.
 * Это даёт батчинг запросов и гибкость на фронтенде.
 */
@Injectable()
export class DisplayContextService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Контекст для проводки «Зарплата по заказу»: sourceId = orderId (как в старой CRM).
   * Автомобиль заказа: «Марка Модель | Госномер», например VW VOLKSWAGEN CARAVELLE | У012ХТ71.
   */
  async getOrderContextByOrderIdForSalary(
    ctx: AuthContext,
    orderId: string,
  ): Promise<string> {
    const { tenantId } = ctx;
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, tenantId },
      select: {
        car: {
          select: {
            gosnomer: true,
            vehicle: {
              select: {
                name: true,
                manufacturer: { select: { name: true } },
              },
            },
          },
        },
      },
    });
    if (!order?.car) return '';
    const car = order.car;
    const manufacturerName = car.vehicle?.manufacturer?.name ?? '';
    const vehicleName = car.vehicle?.name ?? '';
    const carLabel = [manufacturerName, vehicleName].filter(Boolean).join(' ');
    const gosnomer = car.gosnomer?.trim() ?? '';
    if (!carLabel && !gosnomer) return '';
    if (!gosnomer) return carLabel;
    return carLabel ? `${carLabel} | ${gosnomer}` : gosnomer;
  }

  /** Контекст заказа: «№123 Фамилия Имя» или «№123 Название организации». */
  async getOrderContext(ctx: AuthContext, orderId: string): Promise<string> {
    const { tenantId } = ctx;
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

  /** Отображение операнда: «Фамилия Имя» или название организации. */
  async getOperandDisplayName(operandId: string): Promise<string | null> {
    const person = await this.prisma.person.findUnique({
      where: { id: operandId },
      select: { lastname: true, firstname: true },
    });
    if (person) {
      const name = [person.lastname, person.firstname]
        .filter(Boolean)
        .join(' ');
      return name || null;
    }
    const org = await this.prisma.organization.findUnique({
      where: { id: operandId },
      select: { name: true },
    });
    return org?.name ?? null;
  }

  /** Название запчасти по id. */
  async getPartName(partId: string): Promise<string | null> {
    const part = await this.prisma.part.findUnique({
      where: { id: partId },
      select: { name: true },
    });
    return part?.name ?? null;
  }

  /** Название производителя по id. */
  async getManufacturerName(manufacturerId: string): Promise<string | null> {
    const manufacturer = await this.prisma.manufacturer.findUnique({
      where: { id: manufacturerId },
      select: { name: true },
    });
    return manufacturer?.name ?? null;
  }

  /** Название организации по id. */
  async getOrganizationName(organizationId: string): Promise<string | null> {
    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { name: true },
    });
    return org?.name ?? null;
  }

  /** Подпись исполнителя: workerId — это personId, с откатом на employee.id. */
  async getWorkerDisplay(workerId: string): Promise<string | null> {
    const byPerson = await this.getPersonDisplay(workerId);
    if (byPerson) return byPerson;
    const employee = await this.prisma.employee.findUnique({
      where: { id: workerId },
      select: { person: { select: { lastname: true, firstname: true } } },
    });
    if (!employee) return null;
    return (
      [employee.person.lastname, employee.person.firstname]
        .filter(Boolean)
        .join(' ')
        .trim() || null
    );
  }

  /** Название модели (vehicle): «Марка Модель». */
  async getVehicleName(vehicleId: string): Promise<string | null> {
    const vehicle = await this.prisma.vehicle.findUnique({
      where: { id: vehicleId },
      select: { name: true, manufacturer: { select: { name: true } } },
    });
    if (!vehicle) return null;
    return (
      [vehicle.manufacturer?.name, vehicle.name].filter(Boolean).join(' ') ||
      null
    );
  }

  /** Подпись автомобиля: «Марка Модель Госномер». */
  async getCarDisplay(carId: string): Promise<string | null> {
    const car = await this.prisma.car.findUnique({
      where: { id: carId },
      select: {
        gosnomer: true,
        vehicle: {
          select: { name: true, manufacturer: { select: { name: true } } },
        },
      },
    });
    if (!car) return null;
    const label = [car.vehicle?.manufacturer?.name, car.vehicle?.name]
      .filter(Boolean)
      .join(' ');
    const gosnomer = car.gosnomer?.trim();
    return [label, gosnomer].filter(Boolean).join(' ') || null;
  }

  /** Подпись элемента заказа: название группы / работы / запчасти. */
  async getOrderItemDisplay(orderItemId: string): Promise<string | null> {
    const item = await this.prisma.orderItem.findUnique({
      where: { id: orderItemId },
      select: {
        group: { select: { name: true } },
        service: { select: { service: true } },
        part: { select: { part: { select: { name: true } } } },
      },
    });
    return (
      item?.group?.name ??
      item?.service?.service ??
      item?.part?.part?.name ??
      null
    );
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

  /** Название статьи расходов по id (для sourceDisplay при source=Expense). */
  async getExpenseName(ctx: AuthContext, expenseId: string): Promise<string> {
    const { tenantId } = ctx;
    const expense = await this.prisma.expense.findFirst({
      where: { id: expenseId, tenantId },
      select: { name: true },
    });
    return expense?.name ?? '';
  }

  /** Название кошелька по id проводки по кошельку (wallet_transaction.id). */
  async getWalletNameByWalletTransactionId(
    ctx: AuthContext,
    walletTransactionId: string,
  ): Promise<string> {
    const { tenantId } = ctx;
    const wt = await this.prisma.walletTransaction.findFirst({
      where: { id: walletTransactionId, tenantId },
      select: { wallet: { select: { name: true } } },
    });
    return wt?.wallet?.name ?? '';
  }
}
