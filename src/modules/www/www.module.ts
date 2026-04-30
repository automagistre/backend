import { Module } from '@nestjs/common';
import { WwwResolver } from './www.resolver';
import { WwwService } from './www.service';

/**
 * Публичный www-эндпоинт, заменяющий legacy CRM Symfony /api (App\Site).
 * Регистрируется в отдельном GraphQLModule (см. app.module.ts) с `path: /api/www`,
 * `include: [WwwModule]` и `@Public()` резолверами без auth.
 *
 * Tenant определяется по header `X-Tenant-Public-Id` (или path-сегменту
 * `/api/www/:publicId`, который переписывается fastify-хуком в header).
 */
@Module({
  providers: [WwwService, WwwResolver],
  exports: [],
})
export class WwwModule {}
