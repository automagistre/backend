import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { TenantService } from 'src/common/services/tenant.service';
import { EmployeeService } from 'src/modules/employee/employee.service';
import { CustomerTransactionService } from 'src/modules/customer-transaction/customer-transaction.service';
import { CustomerTransactionSource } from 'src/modules/customer-transaction/enums/customer-transaction-source.enum';
import { CreateCustomerTransactionInput } from 'src/modules/customer-transaction/inputs/create-customer-transaction.input';
import { SettingsService } from 'src/modules/settings/settings.service';

/**
 * Начисление зарплаты по заказу: по каждой работе (OrderItemService) с workerId
 * создаётся проводка по персоне сотрудника с source = 4 (Зарплата по заказу).
 *
 * Вызывать после успешного закрытия заказа (после commit OrderClose + OrderDeal).
 * Рекомендуется ставить в очередь (Bull/BullMQ) с ретраями, чтобы не блокировать ответ и не терять начисления при ошибке.
 * Точка вызова: в сценарии закрытия заказа после commit — salaryService.chargeByOrder(orderId) или add job { orderId }.
 * Идемпотентно по заказу: sourceId = orderId (как в старой CRM).
 */
@Injectable()
export class SalaryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantService: TenantService,
    private readonly employeeService: EmployeeService,
    private readonly customerTransactionService: CustomerTransactionService,
    private readonly settingsService: SettingsService,
  ) {}

  /**
   * Начислить зарплату по заказу (проводки по персоне сотрудника за каждую работу).
   * sourceId = orderId (как в старой CRM). Идемпотентно: если по заказу уже есть проводки с source=4 — выходим.
   * Закрытость заказа не проверяет — ожидается, что вызывающая сторона (мутация) уже проверила.
   */
  async chargeByOrder(orderId: string): Promise<void> {
    const tenantId = await this.tenantService.getTenantId();

    const alreadyCharged = await this.prisma.customerTransaction.findFirst({
      where: {
        source: CustomerTransactionSource.OrderSalary,
        sourceId: orderId,
        tenantId,
      },
    });
    if (alreadyCharged) return;

    const defaultCurrency = await this.settingsService.getDefaultCurrencyCode();
    const items = await this.prisma.orderItem.findMany({
      where: { orderId },
      include: { service: true },
    });

    const services = items.filter((item) => item.service !== null);
    const toCreate: CreateCustomerTransactionInput[] = [];

    for (const item of services) {
      const svc = item.service!;
      if (!svc.workerId) continue;

      const priceAmount = svc.priceAmount ?? 0n;
      const discountAmount = svc.discountAmount ?? 0n;
      const totalPrice = priceAmount - discountAmount;
      if (totalPrice <= 0n) continue;

      // workerId в OrderItemService может быть personId или employeeId (в зависимости от того, что отправил UI)
      const employee = await this.employeeService.resolveEmployeeByWorkerId(svc.workerId);
      if (!employee || employee.ratio == null || employee.firedAt) continue;

      const amount = (totalPrice * BigInt(employee.ratio)) / 100n;
      if (amount <= 0n) continue;

      toCreate.push({
        operandId: employee.personId,
        source: CustomerTransactionSource.OrderSalary,
        sourceId: orderId,
        amount: { amountMinor: amount, currencyCode: defaultCurrency },
      });
    }

    if (toCreate.length === 0) return;

    await this.prisma.$transaction(async (tx) => {
      for (const data of toCreate) {
        await this.customerTransactionService.createWithinTransaction(
          tx,
          data,
          tenantId,
        );
      }
    });
  }

  /**
   * Начислить ежемесячные оклады по дню месяца (payday).
   * source = 8 (MonthlySalary), sourceId = EmployeeSalary.id.
   * Идемпотентно: если по salary.id уже есть проводка с source=8 — пропускаем.
   * Учитывает короткие месяцы: при payday=31 в феврале начисляем 28-го, в апреле/июне и т.д. — в последний день.
   */
  async chargeMonthlySalaries(payday: number): Promise<void> {
    const tenantId = await this.tenantService.getTenantId();
    const defaultCurrency = await this.settingsService.getDefaultCurrencyCode();

    const now = new Date();
    const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const isLastDayOfMonth = payday === lastDayOfMonth;

    const paydayFilter = isLastDayOfMonth
      ? { OR: [{ payday }, { payday: { gt: lastDayOfMonth } }] }
      : { payday };

    const salaries = await this.prisma.employeeSalary.findMany({
      where: {
        tenantId,
        ...paydayFilter,
        employeeSalaryEnd: null,
        employee: { firedAt: null },
      },
      include: { employee: true },
    });

    const toCreate: CreateCustomerTransactionInput[] = [];

    for (const s of salaries) {
      const exists = await this.prisma.customerTransaction.findFirst({
        where: {
          source: CustomerTransactionSource.MonthlySalary,
          sourceId: s.id,
          tenantId,
        },
      });
      if (exists) continue;
      if (s.amount <= 0n) continue;

      toCreate.push({
        operandId: s.employee.personId,
        source: CustomerTransactionSource.MonthlySalary,
        sourceId: s.id,
        amount: { amountMinor: s.amount, currencyCode: defaultCurrency },
      });
    }

    if (toCreate.length === 0) return;

    await this.prisma.$transaction(async (tx) => {
      for (const data of toCreate) {
        await this.customerTransactionService.createWithinTransaction(
          tx,
          data,
          tenantId,
        );
      }
    });
  }
}
