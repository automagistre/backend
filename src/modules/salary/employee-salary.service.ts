import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { TenantService } from 'src/common/services/tenant.service';
import { CreateEmployeeSalaryInput } from './inputs/create-employee-salary.input';
import { applyDefaultCurrency } from 'src/common/money';
import { SettingsService } from 'src/modules/settings/settings.service';

@Injectable()
export class EmployeeSalaryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantService: TenantService,
    private readonly settingsService: SettingsService,
  ) {}

  async listByEmployee(employeeId: string) {
    const tenantId = await this.tenantService.getTenantId();

    const items = await this.prisma.employeeSalary.findMany({
      where: { employeeId, tenantId },
      include: { employeeSalaryEnd: true },
      orderBy: { createdAt: 'desc' },
    });

    return items.map((row) => ({
      id: row.id,
      employeeId: row.employeeId,
      payday: row.payday,
      amount: row.amount,
      createdAt: row.createdAt,
      isCancelled: row.employeeSalaryEnd != null,
    }));
  }

  async create(input: CreateEmployeeSalaryInput) {
    const tenantId = await this.tenantService.getTenantId();

    const employee = await this.prisma.employee.findFirst({
      where: { id: input.employeeId, tenantId },
    });
    if (!employee) {
      throw new NotFoundException('Employee not found');
    }

    const defaultCurrency = await this.settingsService.getDefaultCurrencyCode();
    const money = applyDefaultCurrency(input.amount, defaultCurrency);

    return this.prisma.employeeSalary.create({
      data: {
        employeeId: input.employeeId,
        payday: input.payday,
        amount: money.amountMinor,
        tenantId,
      },
    });
  }

  /** Создать запись EmployeeSalaryEnd — отмена начисления (не начислять в будущем). */
  async cancel(salaryId: string) {
    const tenantId = await this.tenantService.getTenantId();

    const salary = await this.prisma.employeeSalary.findFirst({
      where: { id: salaryId, tenantId },
      include: { employeeSalaryEnd: true },
    });
    if (!salary) {
      throw new NotFoundException('Employee salary not found');
    }
    if (salary.employeeSalaryEnd) {
      throw new NotFoundException('Salary already cancelled');
    }

    return this.prisma.employeeSalaryEnd.create({
      data: {
        salaryId,
        tenantId,
      },
    });
  }
}
