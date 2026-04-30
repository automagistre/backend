import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
} from '@nestjs/common';
import { Public } from 'src/modules/auth/decorators/public.decorator';
import {
  InteractiveResponse,
  UisInteractiveService,
} from './uis-interactive.service';

/**
 * Публичный endpoint, который дёргает кабинет UIS при входящем звонке.
 * Контракт ответа повторяет старый Symfony InteractiveController
 * (`crm/src/ATS/Controller/InteractiveController.php`), чтобы UIS-сценарий
 * можно было переключить простой сменой URL.
 *
 * Tenant определяется по сегменту `:publicId` (5-значный publicId из
 * tenant.public_id). Старый CRM-эндпоинт `/{tenant}/uiscom/interactive`
 * выводим из эксплуатации после стабилизации Phase 2.
 */
@Controller(['integrations/uis', 'api/integrations/uis'])
export class UisInteractiveController {
  constructor(
    private readonly uisInteractiveService: UisInteractiveService,
  ) {}

  @Public()
  @Post(':publicId/interactive')
  @HttpCode(HttpStatus.OK)
  handle(
    @Param('publicId', ParseIntPipe) publicId: number,
    @Body() body: Record<string, unknown>,
  ): Promise<InteractiveResponse> {
    return this.uisInteractiveService.handle(publicId, body);
  }
}
