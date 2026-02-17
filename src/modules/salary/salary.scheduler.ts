import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { SalaryService } from './salary.service';
import {
  userIdStore,
  SYSTEM_USER_ID,
  DEFAULT_TENANT_ID,
} from '../../common/user-id.store';

@Injectable()
export class SalaryScheduler {
  constructor(private readonly salaryService: SalaryService) {}

  /** Ежедневно в 00:05 — начислить ежемесячные оклады по текущему дню месяца. */
  @Cron('5 0 * * *')
  async handleMonthlySalaries() {
    const payday = new Date().getDate();
    await userIdStore.run(
      { userId: SYSTEM_USER_ID, tenantId: DEFAULT_TENANT_ID },
      () => this.salaryService.chargeMonthlySalaries(payday),
    );
  }
}
