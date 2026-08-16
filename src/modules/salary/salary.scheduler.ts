import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { SalaryService } from './salary.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { SYSTEM_USER_ID, type AuthContext } from 'src/common/user-id.store';

@Injectable()
export class SalaryScheduler {
  private readonly logger = new Logger(SalaryScheduler.name);

  constructor(
    private readonly salaryService: SalaryService,
    private readonly prisma: PrismaService,
  ) {}

  @Cron('5 0 * * *')
  async handleMonthlySalaries(): Promise<void> {
    const payday = new Date().getDate();
    await this.runForAllTenants(payday);
  }

  /** 1-го числа в 00:10 — доплата до гарантированного минимума за прошлый месяц. */
  @Cron('10 0 1 * *')
  async handleMinimumWage(): Promise<void> {
    const now = new Date();
    const targetMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    await this.runMinimumWageForAllTenants(targetMonthStart);
  }

  async runForAllTenants(payday: number): Promise<void> {
    await this.forEachTenant(`chargeMonthlySalaries payday=${payday}`, (ctx) =>
      this.salaryService.chargeMonthlySalaries(ctx, payday),
    );
  }

  async runMinimumWageForAllTenants(targetMonthStart: Date): Promise<void> {
    const month = targetMonthStart.toISOString().slice(0, 7);
    await this.forEachTenant(`chargeMinimumWage month=${month}`, (ctx) =>
      this.salaryService.chargeMinimumWage(ctx, targetMonthStart),
    );
  }

  /**
   * Запускает задачу по всем тенантам от системного пользователя.
   * Падение одного тенанта не останавливает остальные.
   */
  private async forEachTenant(
    label: string,
    run: (ctx: AuthContext) => Promise<void>,
  ): Promise<void> {
    const tenants = await this.prisma.tenant.findMany({
      select: { id: true, group_id: true },
    });
    this.logger.log(`${label}: tenants=${tenants.length}`);

    for (const tenant of tenants) {
      try {
        await run({
          userId: SYSTEM_USER_ID,
          tenantId: tenant.id,
          tenantGroupId: tenant.group_id,
        });
      } catch (err) {
        this.logger.error(
          `${label}: tenantId=${tenant.id} failed`,
          err instanceof Error ? err.stack : String(err),
        );
      }
    }
  }
}
