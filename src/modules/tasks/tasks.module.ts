import { Module } from '@nestjs/common';
import { CommonModule } from 'src/common/common.module';
import { PrismaModule } from 'src/prisma/prisma.module';
import { SettingsModule } from '../settings/settings.module';
import { TasksResolver } from './tasks.resolver';
import { TasksScheduler } from './tasks.scheduler';
import { TasksService } from './tasks.service';

@Module({
  imports: [PrismaModule, CommonModule, SettingsModule],
  providers: [TasksService, TasksResolver, TasksScheduler],
  exports: [TasksService],
})
export class TasksModule {}
