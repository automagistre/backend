import { Controller, Post, Body, Get, Query } from '@nestjs/common';
import { WebhookService } from './webhook.service';

@Controller('webhook')
export class WebhookController {
  constructor(private readonly webhookService: WebhookService) {}

  @Get('grant-after-hours-access')
  async uisGrantAfterHoursAccess(@Query() query: { numa: string }) {
    try {
      await this.webhookService.openThirdGateByClient(query.numa);
      return {
        text: 'Доступ на территорию разрешен',
      };
    } catch (error) {
      return {
        text: 'Нет доступа, обратитесь в рабочее время',
      };
    }
  }
}
