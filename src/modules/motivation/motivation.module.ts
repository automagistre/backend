import { Module } from '@nestjs/common';
import { ShiftModule } from 'src/modules/shift/shift.module';
import { MotivationBacktestResolver } from './backtest/motivation-backtest.resolver';
import { MotivationBacktestService } from './backtest/motivation-backtest.service';
import { MotivationFactsService } from './facts/motivation-facts.service';

@Module({
  imports: [ShiftModule],
  providers: [
    MotivationFactsService,
    MotivationBacktestService,
    MotivationBacktestResolver,
  ],
  exports: [MotivationFactsService],
})
export class MotivationModule {}
