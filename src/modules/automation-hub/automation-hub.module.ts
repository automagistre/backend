import { Module } from '@nestjs/common';
import { AutomationHubService } from './automation-hub.service';
import { HomeAssistantModule } from '../home-assistant/home-assistant.module';

@Module({
  imports: [HomeAssistantModule],
  providers: [AutomationHubService],
  exports: [AutomationHubService],
})
export class AutomationHubModule {}
