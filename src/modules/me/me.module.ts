import { Module } from '@nestjs/common';
import { MeResolver } from './me.resolver';
import { MeService } from './me.service';

/**
 * Клиентский endpoint (использует LK BFF / другие сервисы).
 * Все операции с префиксом `my*`. Аналогично WwwModule —
 * tenant определяется по `X-Tenant-Public-Id`.
 */
@Module({
  providers: [MeService, MeResolver],
})
export class MeModule {}
