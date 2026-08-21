import { Module } from '@nestjs/common';
import { PrismaModule } from 'src/prisma/prisma.module';
import { CogsModule } from 'src/modules/cogs/cogs.module';
import { ShiftModule } from 'src/modules/shift/shift.module';
import { AnalyticsService } from './analytics.service';

@Module({
  imports: [PrismaModule, CogsModule, ShiftModule],
  providers: [AnalyticsService],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
