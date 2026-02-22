import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { SalaryService } from './salary.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { SYSTEM_USER_ID } from 'src/common/user-id.store';

@Injectable()
export class SalaryScheduler {
  constructor(
    private readonly salaryService: SalaryService,
    private readonly prisma: PrismaService,
  ) {}

  @Cron('5 0 * * *')
  async handleMonthlySalaries() {
    const payday = new Date().getDate();
    const tenants = await this.prisma.tenant.findMany({
      select: { id: true, group_id: true },
    });

    for (const tenant of tenants) {
      const ctx = {
        userId: SYSTEM_USER_ID,
        tenantId: tenant.id,
        tenantGroupId: tenant.group_id,
      };
      await this.salaryService.chargeMonthlySalaries(ctx, payday);
    }
  }
}
