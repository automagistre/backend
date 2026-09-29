import { Module } from '@nestjs/common';
import { ShiftModule } from 'src/modules/shift/shift.module';
import { MotivationFactsService } from './facts/motivation-facts.service';

@Module({
  imports: [ShiftModule],
  providers: [MotivationFactsService],
  exports: [MotivationFactsService],
})
export class MotivationModule {}
