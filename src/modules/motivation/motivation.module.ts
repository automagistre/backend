import { Module } from '@nestjs/common';
import { ShiftModule } from 'src/modules/shift/shift.module';
import { ProfitModule } from 'src/modules/profit/profit.module';
import { CustomerTransactionModule } from 'src/modules/customer-transaction/customer-transaction.module';
import { MotivationAccrualResolver } from './accrual/motivation-accrual.resolver';
import { MotivationAccrualService } from './accrual/motivation-accrual.service';
import { MotivationFactsService } from './facts/motivation-facts.service';
import { MotivationSchemeResolver } from './scheme/motivation-scheme.resolver';
import { MotivationSchemeService } from './scheme/motivation-scheme.service';

@Module({
  imports: [ShiftModule, ProfitModule, CustomerTransactionModule],
  providers: [
    MotivationFactsService,
    MotivationSchemeService,
    MotivationSchemeResolver,
    MotivationAccrualService,
    MotivationAccrualResolver,
  ],
  exports: [MotivationFactsService, MotivationAccrualService],
})
export class MotivationModule {}
