import {
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  Query,
} from '@nestjs/common';
import { Public } from 'src/modules/auth/decorators/public.decorator';
import { UisCallsWebhookService } from './uis-calls-webhook.service';

@Controller(['integrations/uis', 'api/integrations/uis'])
export class UisCallsController {
  constructor(
    private readonly uisCallsWebhookService: UisCallsWebhookService,
  ) {}

  @Public()
  @Post('webhook/call')
  @HttpCode(HttpStatus.OK)
  async ingestCallWebhook(
    @Body() payload: Record<string, unknown>,
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Query('token') token?: string,
    @Query('webhook_token') webhookToken?: string,
  ) {
    return this.uisCallsWebhookService.ingestWebhook(
      payload,
      headers,
      token ?? webhookToken,
    );
  }
}
