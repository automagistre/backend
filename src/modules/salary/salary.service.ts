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
import { WarrantyPayerKind } from 'src/modules/order/enums/warranty-payer-kind.enum';
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
      // ЗП не начисляется только если плательщик гарантии — тот же сотрудник,
      // что и исполнитель (сам виноват — сам не получает оплату, см.
      // chargeWarrantyExecutorDeductions). Во всех остальных случаях (платит
      // организация или другой сотрудник) исполнитель получает ЗП как обычно.
      const isSamePersonWarranty =
        svc.warranty &&
        svc.warrantyPayerKind === WarrantyPayerKind.EMPLOYEE &&
        svc.warrantyPayerPersonId === svc.executorId;
      if (isSamePersonWarranty) {
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
   * Удержание с сотрудника за гарантийную работу по его же вине (плательщик =
   * исполнитель, kind=AUTOSERVICE). Сумма = price×(100−ratio)% — та маржа,
   * которую организация получила бы в обычной работе; удержание компенсирует
   * её, раз выручки по гарантии нет (сам ЗП за эту позицию не начисляется,
   * см. chargeByOrder). ContractorPayout не создаётся при гарантии подрядчика
   * (см. syncContractorPayout), поэтому здесь только AUTOSERVICE.
   */
  async chargeWarrantyExecutorDeductions(
    ctx: AuthContext,
    orderId: string,
  ): Promise<void> {
    const defaultCurrency = await this.settingsService.getDefaultCurrencyCode();
    const items = await this.prisma.orderItem.findMany({
      where: {
        orderId,
        service: {
          warranty: true,
          warrantyPayerKind: WarrantyPayerKind.EMPLOYEE,
          kind: 'AUTOSERVICE',
        },
      },
      include: { service: true },
    });
    const services = items.filter(
      (item) =>
        item.service !== null &&
        item.service.warrantyPayerPersonId === item.service.executorId,
    );
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
   * Гарантия за работу, где плательщик — ДРУГОЙ сотрудник (не исполнитель):
   * исполнитель получает ЗП как обычно (chargeByOrder), а плательщик
   * компенсирует организации и ЗП исполнителя, и потерянную маржу — двумя
   * отдельными проводками (WarrantySalaryCompensation + WarrantyMarginDeduction).
   */
  async chargeWarrantyPayerCompensation(
    ctx: AuthContext,
    orderId: string,
  ): Promise<void> {
    const defaultCurrency = await this.settingsService.getDefaultCurrencyCode();
    const items = await this.prisma.orderItem.findMany({
      where: {
        orderId,
        service: {
          warranty: true,
          warrantyPayerKind: WarrantyPayerKind.EMPLOYEE,
          kind: 'AUTOSERVICE',
        },
      },
      include: { service: true },
    });
    const services = items.filter(
      (item) =>
        item.service !== null &&
        item.service.warrantyPayerPersonId != null &&
        item.service.warrantyPayerPersonId !== item.service.executorId,
    );
    if (services.length === 0) return;

    const alreadyCharged = await this.prisma.customerTransaction.findMany({
      where: {
        source: {
          in: [
            CustomerTransactionSource.WarrantySalaryCompensation,
            CustomerTransactionSource.WarrantyMarginDeduction,
          ],
        },
        sourceId: { in: services.map((item) => item.id) },
        tenantId: ctx.tenantId,
      },
      select: { sourceId: true, source: true },
    });
    const chargedKeys = new Set(
      alreadyCharged.map((t) => `${t.sourceId}:${t.source}`),
    );

    for (const item of services) {
      const svc = item.service!;
      const payerPersonId = svc.warrantyPayerPersonId!;

      if (svc.executorKind !== PartyKind.PERSON || !svc.executorId) continue;

      const base = (svc.priceAmount ?? 0n) - (svc.discountAmount ?? 0n);
      if (base <= 0n) continue;

      const employee = await this.employeeService.findByPersonId(
        ctx,
        svc.executorId,
      );
      if (!employee || employee.ratio == null || employee.firedAt) continue;

      const salaryAmount = (base * BigInt(employee.ratio)) / 100n;
      const marginAmount = base - salaryAmount;

      await this.prisma.$transaction(async (tx) => {
        if (
          salaryAmount > 0n &&
          !chargedKeys.has(
            `${item.id}:${CustomerTransactionSource.WarrantySalaryCompensation}`,
          )
        ) {
          await this.customerTransactionService.createWithinTransaction(
            tx,
            {
              operandId: payerPersonId,
              source: CustomerTransactionSource.WarrantySalaryCompensation,
              sourceId: item.id,
              amount: {
                amountMinor: -salaryAmount,
                currencyCode: defaultCurrency,
              },
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
                  amountMinor: String(-salaryAmount),
                  currencyCode: defaultCurrency,
                },
              },
            ],
            entityDisplayName: svc.service,
          });
        }

        if (
          marginAmount > 0n &&
          !chargedKeys.has(
            `${item.id}:${CustomerTransactionSource.WarrantyMarginDeduction}`,
          )
        ) {
          await this.customerTransactionService.createWithinTransaction(
            tx,
            {
              operandId: payerPersonId,
              source: CustomerTransactionSource.WarrantyMarginDeduction,
              sourceId: item.id,
              amount: {
                amountMinor: -marginAmount,
                currencyCode: defaultCurrency,
              },
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
                  amountMinor: String(-marginAmount),
                  currencyCode: defaultCurrency,
                },
              },
            ],
            entityDisplayName: svc.service,
          });
        }
      });
    }
  }

  /**
   * Удержание с сотрудника-плательщика за гарантийную запчасть (warrantyPayerKind=
   * EMPLOYEE). Сумма = себестоимость на момент закрытия заказа (CogsService).
   * Если плательщик — организация, удержания нет (она поглощает стоимость).
   */
  async chargeWarrantyPartDeductions(
    ctx: AuthContext,
    orderId: string,
  ): Promise<void> {
    const defaultCurrency = await this.settingsService.getDefaultCurrencyCode();

    const items = await this.prisma.orderItem.findMany({
      where: {
        orderId,
        part: { warranty: true, warrantyPayerKind: WarrantyPayerKind.EMPLOYEE },
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

      const personId = part.warrantyPayerPersonId;
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
