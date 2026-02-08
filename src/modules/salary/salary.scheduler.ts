import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { SalaryService } from './salary.service';

@Injectable()
export class SalaryScheduler {
  constructor(private readonly salaryService: SalaryService) {}

  /** Ежедневно в 00:05 — начислить ежемесячные оклады по текущему дню месяца. */
  @Cron('5 0 * * *')
  async handleMonthlySalaries() {
    const payday = new Date().getDate();
    await this.salaryService.chargeMonthlySalaries(payday);
  }
}
