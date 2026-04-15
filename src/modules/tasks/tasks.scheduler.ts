import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { SYSTEM_USER_ID } from 'src/common/user-id.store';
import { PrismaService } from 'src/prisma/prisma.service';
import { TasksService } from './tasks.service';

const TASKS_ARCHIVE_CRON = '17 1 * * *';

@Injectable()
export class TasksScheduler {
  private readonly logger = new Logger(TasksScheduler.name);

  constructor(
    private readonly tasksService: TasksService,
    private readonly prisma: PrismaService,
  ) {}

  @Cron(TASKS_ARCHIVE_CRON)
  async archiveSuccessfulQualityControlTasksByCron(): Promise<void> {
    const tenants = await this.prisma.tenant.findMany({
      select: { id: true, group_id: true },
    });

    for (const tenant of tenants) {
      try {
        const archivedCount =
          await this.tasksService.archiveSuccessfulQualityControlTasksForTenant(
            {
              userId: SYSTEM_USER_ID,
              tenantId: tenant.id,
              tenantGroupId: tenant.group_id,
            },
          );
        if (archivedCount > 0) {
          this.logger.log(
            `Tenant ${tenant.id}: archived ${archivedCount} QC tasks`,
          );
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.error(
          `Tenant ${tenant.id}: failed to archive QC tasks: ${message}`,
        );
      }
    }
  }
}
