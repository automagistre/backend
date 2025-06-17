import { Injectable } from '@nestjs/common';
import { HomeAssistantService } from '../home-assistant/home-assistant.service';

@Injectable()
export class AutomationHubService {
  constructor(private readonly homeAssistantService: HomeAssistantService) {}

  async openRearGate(): Promise<void> {
    await this.homeAssistantService.callService('switch', 'turn_on', {
      entity_id: 'switch.rear_gate_open',
    });
  }
}
