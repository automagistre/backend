import { Module } from '@nestjs/common';
import { WebhookService } from './webhook.service';
import { WebhookController } from './webhook.controller';
import { CalendarModule } from 'src/modules/calendar/calendar.module';
import { AutomationHubModule } from 'src/modules/automation-hub/automation-hub.module';

@Module({
  imports: [CalendarModule, AutomationHubModule],
  controllers: [WebhookController],
  providers: [WebhookService],
})
export class WebhookModule {}
