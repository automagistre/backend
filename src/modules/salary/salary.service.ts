import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { EmployeeService } from 'src/modules/employee/employee.service';
import { CustomerTransactionService } from 'src/modules/customer-transaction/customer-transaction.service';
import { CustomerTransactionSource } from 'src/modules/customer-transaction/enums/customer-transaction-source.enum';
import { CreateCustomerTransactionInput } from 'src/modules/customer-transaction/inputs/create-customer-transaction.input';
import { SettingsService } from 'src/modules/settings/settings.service';
import type { AuthContext } from 'src/common/user-id.store';
import { applyDefaultCurrency, sum } from 'src/common/money';
import { PartyKind } from 'src/common/party';
import { AuditLogService } from 'src/modules/audit-log/audit-log.service';
import { DisplayContextService } from 'src/modules/display-context/display-context.service';
import { CogsService } from 'src/modules/cogs/cogs.service';
import { WarrantyPayer } from 'src/modules/order/enums/warranty-payer.enum';
import {
  findAncestorService,
  resolvePartWarrantyChargePersonId,
  resolvePartWarrantyPayer,
  type WarrantyOrderItemNode,
} from 'src/modules/order/warranty-payer.resolve';
import {
  AuditAction,
  AuditEntityType,
} from 'src/modules/audit-log/enums/audit.enums';

@Injectable()
export class SalaryService {
  private readonly logger = new Logger(SalaryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly employeeService: EmployeeService,
    private readonly customerTransactionService: CustomerTransactionService,
    private readonly settingsService: SettingsService,
    private readonly auditLog: AuditLogService,
    private readonly displayContext: DisplayContextService,
    private readonly cogsService: CogsService,
  ) {}

  async chargeByOrder(ctx: AuthContext, orderId: string): Promise<void> {
    const alreadyCharged = await this.prisma.customerTransaction.findFirst({
      where: {
        source: CustomerTransactionSource.OrderSalary,
        sourceId: orderId,
        tenantId: ctx.tenantId,
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
      // Гарантия за счёт исполнителя — ЗП не начисляется, вместо неё удержание
      // с сотрудника (chargeWarrantyWorkDeductions). За счёт организации —
      // начисляем ЗП как за обычную работу (выручки нет, но труд оплачивается).
      if (svc.warranty && svc.warrantyPayer !== WarrantyPayer.ORGANIZATION) {
        continue;
      }

      // Подрядные работы оплачиваются подрядчику (ContractorPayout), а не в ЗП.
      if (svc.kind === 'CONTRACTOR') continue;

      // Зарплата начисляется только персонам (сотрудникам); организации-подрядчики — нет.
      if (!svc.executorId || svc.executorKind !== PartyKind.PERSON) continue;
      const executorPersonId = svc.executorId;

      const priceAmount = svc.priceAmount ?? 0n;
      const discountAmount = svc.discountAmount ?? 0n;
      const totalPrice = priceAmount - discountAmount;
      if (totalPrice <= 0n) continue;

      const employee = await this.employeeService.findByPersonId(
        ctx,
        executorPersonId,
      );
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

    const total = sum(
      toCreate.map((d) => applyDefaultCurrency(d.amount ?? {}, defaultCurrency)),
      defaultCurrency,
    );

    const recipientIds = Array.from(new Set(toCreate.map((d) => d.operandId)));
    const recipientNames =
      (
        await Promise.all(
          recipientIds.map((id) => this.displayContext.getPersonDisplay(id)),
        )
      )
        .filter(Boolean)
        .join(', ') || null;

    await this.prisma.$transaction(async (tx) => {
      for (const data of toCreate) {
        await this.customerTransactionService.createWithinTransaction(
          tx,
          data,
          ctx.tenantId,
          ctx.userId,
        );
      }

      await this.auditLog.record(tx, ctx, {
        rootEntityType: AuditEntityType.ORDER,
        rootEntityId: orderId,
        entityType: AuditEntityType.SALARY,
        entityId: orderId,
        action: AuditAction.SALARY_ACCRUE,
        changes: [
          {
            field: 'amount',
            oldValue: null,
            newValue: {
              amountMinor: String(total.amountMinor),
              currencyCode: total.currencyCode,
            },
          },
        ],
        entityDisplayName: recipientNames,
        metadata: { count: toCreate.length },
      });
    });
  }

  /**
   * Удержание с сотрудника за гарантийную работу по его вине (warrantyPayer=EXECUTOR,
   * kind=AUTOSERVICE). Сумма = price×(100−ratio)% — та маржа, которую организация
   * получила бы в обычной работе; удержание компенсирует её, раз выручки по гарантии нет.
   * ContractorPayout не создаётся при EXECUTOR-гарантии (см. syncContractorPayout),
   * поэтому здесь только AUTOSERVICE.
   */
  async chargeWarrantyWorkDeductions(
    ctx: AuthContext,
    orderId: string,
  ): Promise<void> {
    const defaultCurrency = await this.settingsService.getDefaultCurrencyCode();
    const items = await this.prisma.orderItem.findMany({
      where: {
        orderId,
        service: {
          warranty: true,
          warrantyPayer: WarrantyPayer.EXECUTOR,
          kind: 'AUTOSERVICE',
        },
      },
      include: { service: true },
    });
    const services = items.filter((item) => item.service !== null);
    if (services.length === 0) return;

    const alreadyCharged = await this.prisma.customerTransaction.findMany({
      where: {
        source: CustomerTransactionSource.WarrantyDeduction,
        sourceId: { in: services.map((item) => item.id) },
        tenantId: ctx.tenantId,
      },
      select: { sourceId: true },
    });
    const chargedIds = new Set(alreadyCharged.map((t) => t.sourceId));

    for (const item of services) {
      if (chargedIds.has(item.id)) continue;
      const svc = item.service!;

      if (svc.executorKind !== PartyKind.PERSON || !svc.executorId) continue;

      const base = (svc.priceAmount ?? 0n) - (svc.discountAmount ?? 0n);
      if (base <= 0n) continue;

      const employee = await this.employeeService.findByPersonId(
        ctx,
        svc.executorId,
      );
      if (!employee || employee.ratio == null || employee.firedAt) continue;

      const deduction = (base * BigInt(100 - employee.ratio)) / 100n;
      if (deduction <= 0n) continue;

      await this.prisma.$transaction(async (tx) => {
        await this.customerTransactionService.createWithinTransaction(
          tx,
          {
            operandId: employee.personId,
            source: CustomerTransactionSource.WarrantyDeduction,
            sourceId: item.id,
            amount: { amountMinor: -deduction, currencyCode: defaultCurrency },
          },
          ctx.tenantId,
          ctx.userId,
        );

        await this.auditLog.record(tx, ctx, {
          rootEntityType: AuditEntityType.ORDER,
          rootEntityId: orderId,
          entityType: AuditEntityType.ORDER_ITEM_SERVICE,
          entityId: item.id,
          action: AuditAction.WARRANTY_DEDUCT,
          changes: [
            {
              field: 'amount',
              oldValue: null,
              newValue: {
                amountMinor: String(-deduction),
                currencyCode: defaultCurrency,
              },
            },
          ],
          entityDisplayName: svc.service,
        });
      });
    }
  }

  /**
   * Удержание с сотрудника за гарантийную запчасть по его вине (warrantyPayer=EXECUTOR).
   * Сумма = себестоимость на момент закрытия заказа (CogsService). Исполнитель —
   * исполнитель родительской работы (если персона), иначе ответственный по заказу.
   */
  async chargeWarrantyPartDeductions(
    ctx: AuthContext,
    orderId: string,
  ): Promise<void> {
    const defaultCurrency = await this.settingsService.getDefaultCurrencyCode();
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, tenantId: ctx.tenantId },
      select: { assigneeId: true },
    });

    const allOrderItems = await this.prisma.orderItem.findMany({
      where: { orderId },
      select: {
        id: true,
        parentId: true,
        service: {
          select: { kind: true, executorKind: true, executorId: true },
        },
      },
    });
    const orderItemsById = new Map<string, WarrantyOrderItemNode>(
      allOrderItems.map((row) => [
        row.id,
        { parentId: row.parentId, service: row.service },
      ]),
    );

    const items = await this.prisma.orderItem.findMany({
      where: {
        orderId,
        part: { warranty: true, warrantyPayer: WarrantyPayer.EXECUTOR },
      },
      include: {
        part: { include: { part: true } },
      },
    });
    const partItems = items.filter((item) => item.part !== null);
    if (partItems.length === 0) return;

    const alreadyCharged = await this.prisma.customerTransaction.findMany({
      where: {
        source: CustomerTransactionSource.WarrantyDeduction,
        sourceId: { in: partItems.map((item) => item.id) },
        tenantId: ctx.tenantId,
      },
      select: { sourceId: true },
    });
    const chargedIds = new Set(alreadyCharged.map((t) => t.sourceId));

    const now = new Date();

    for (const item of partItems) {
      if (chargedIds.has(item.id)) continue;
      const part = item.part!;

      const ancestorService = findAncestorService(item.parentId, orderItemsById);
      const effectivePayer = resolvePartWarrantyPayer(
        ancestorService,
        order?.assigneeId,
        WarrantyPayer.EXECUTOR,
      );
      if (effectivePayer !== WarrantyPayer.EXECUTOR) continue;

      const personId = resolvePartWarrantyChargePersonId(
        ancestorService,
        order?.assigneeId,
      );
      if (!personId) continue;

      const cogs = await this.cogsService.getPartLineCogsAtDate(
        ctx.tenantId,
        part.partId,
        part.quantity,
        now,
      );
      if (cogs <= 0n) continue;

      await this.prisma.$transaction(async (tx) => {
        await this.customerTransactionService.createWithinTransaction(
          tx,
          {
            operandId: personId,
            source: CustomerTransactionSource.WarrantyDeduction,
            sourceId: item.id,
            amount: { amountMinor: -cogs, currencyCode: defaultCurrency },
          },
          ctx.tenantId,
          ctx.userId,
        );

        await this.auditLog.record(tx, ctx, {
          rootEntityType: AuditEntityType.ORDER,
          rootEntityId: orderId,
          entityType: AuditEntityType.ORDER_ITEM_PART,
          entityId: item.id,
          action: AuditAction.WARRANTY_DEDUCT,
          changes: [
            {
              field: 'amount',
              oldValue: null,
              newValue: {
                amountMinor: String(-cogs),
                currencyCode: defaultCurrency,
              },
            },
          ],
          entityDisplayName: part.part?.name ?? null,
        });
      });
    }
  }

  async chargeMonthlySalaries(ctx: AuthContext, payday: number): Promise<void> {
    const defaultCurrency = await this.settingsService.getDefaultCurrencyCode();

    const now = new Date();
    const lastDayOfMonth = new Date(
      now.getFullYear(),
      now.getMonth() + 1,
      0,
    ).getDate();
    const isLastDayOfMonth = payday === lastDayOfMonth;

    const paydayFilter = isLastDayOfMonth
      ? { OR: [{ payday }, { payday: { gt: lastDayOfMonth } }] }
      : { payday };

    const salaries = await this.prisma.employeeSalary.findMany({
      where: {
        tenantId: ctx.tenantId,
        ...paydayFilter,
        employeeSalaryEnd: null,
        employee: { firedAt: null },
      },
      include: { employee: true },
    });

    // Защита от двойного начисления — В ТЕКУЩЕМ МЕСЯЦЕ. Sourceid = salary.id
    // одинаковый из месяца в месяц (legacy-схема: каждый месяц новая транзакция
    // на ту же EmployeeSalary), поэтому фильтровать без даты — заблокирует
    // начисление за май транзакцией от апреля.
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    let charged = 0;
    let skipped = 0;
    let failed = 0;

    for (const s of salaries) {
      try {
        const exists = await this.prisma.customerTransaction.findFirst({
          where: {
            source: CustomerTransactionSource.MonthlySalary,
            sourceId: s.id,
            tenantId: ctx.tenantId,
            createdAt: { gte: startOfMonth },
          },
        });
        if (exists) {
          skipped++;
          continue;
        }
        if (s.amount <= 0n) {
          skipped++;
          continue;
        }

        const data: CreateCustomerTransactionInput = {
          operandId: s.employee.personId,
          source: CustomerTransactionSource.MonthlySalary,
          sourceId: s.id,
          amount: { amountMinor: s.amount, currencyCode: defaultCurrency },
        };

        await this.prisma.$transaction(async (tx) => {
          await this.customerTransactionService.createWithinTransaction(
            tx,
            data,
            ctx.tenantId,
            ctx.userId,
          );
        });
        charged++;
      } catch (err) {
        failed++;
        this.logger.error(
          `chargeMonthlySalaries: salaryId=${s.id} employeeId=${s.employeeId} tenantId=${ctx.tenantId} failed`,
          err instanceof Error ? err.stack : String(err),
        );
      }
    }

    this.logger.log(
      `chargeMonthlySalaries: tenant=${ctx.tenantId} payday=${payday} charged=${charged} skipped=${skipped} failed=${failed} of ${salaries.length}`,
    );
  }
}
