import { Module } from '@nestjs/common';
import { PersonModule } from 'src/modules/person/person.module';
import { MeResolver } from './me.resolver';

/**
 * Клиентский endpoint (используют LK BFF / другие сервисы).
 * Все операции с префиксом `my*`. Аналогично WwwModule —
 * tenant определяется по `X-Tenant-Public-Id`.
 *
 * Бизнес-логика делегируется в PersonService — отдельного сервиса
 * под клиентский слой не вводим.
 */
@Module({
  imports: [PersonModule],
  providers: [MeResolver],
})
export class MeModule {}
