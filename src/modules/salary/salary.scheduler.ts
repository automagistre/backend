import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { SalaryService } from './salary.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { SYSTEM_USER_ID } from 'src/common/user-id.store';

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

  async runForAllTenants(payday: number): Promise<void> {
    const tenants = await this.prisma.tenant.findMany({
      select: { id: true, group_id: true },
    });
    this.logger.log(
      `runForAllTenants: payday=${payday} tenants=${tenants.length}`,
    );

    for (const tenant of tenants) {
      const ctx = {
        userId: SYSTEM_USER_ID,
        tenantId: tenant.id,
        tenantGroupId: tenant.group_id,
      };
      try {
        await this.salaryService.chargeMonthlySalaries(ctx, payday);
      } catch (err) {
        this.logger.error(
          `handleMonthlySalaries: tenantId=${tenant.id} failed`,
          err instanceof Error ? err.stack : String(err),
        );
      }
    }
  }
}
