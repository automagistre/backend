import { Module } from '@nestjs/common';
import { PrismaModule } from 'src/prisma/prisma.module';
import { CommonModule } from 'src/common/common.module';
import { SettingsModule } from '../settings/settings.module';
import { DashboardService } from './dashboard.service';
import { DashboardResolver } from './dashboard.resolver';

@Module({
  imports: [PrismaModule, CommonModule, SettingsModule],
  providers: [DashboardService, DashboardResolver],
})
export class DashboardModule {}
