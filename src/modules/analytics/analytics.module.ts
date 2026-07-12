import { Module } from '@nestjs/common';
import { PrismaModule } from 'src/prisma/prisma.module';
import { CogsModule } from 'src/modules/cogs/cogs.module';
import { AnalyticsService } from './analytics.service';

@Module({
  imports: [PrismaModule, CogsModule],
  providers: [AnalyticsService],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
