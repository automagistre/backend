import {
  Controller,
  Get,
  Inject,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { SkipThrottle } from '@nestjs/throttler';
import { SkipTenant } from 'src/common/decorators/skip-tenant.decorator';
import authConfig from 'src/config/auth.config';
import { Public } from 'src/modules/auth/decorators/public.decorator';
import { PrismaService } from 'src/prisma/prisma.service';

type CheckStatus = 'ok' | 'fail' | 'disabled';

/**
 * Liveness/readiness для Docker и мониторинга. 503 — только при недоступной БД:
 * падение Keycloak видно в ответе, но не снимает backend с Traefik
 * (иначе вместе с SSO падает публичный сайт).
 */
@Public()
@SkipTenant()
@SkipThrottle()
@Controller('api/health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(authConfig.KEY)
    private readonly auth: ConfigType<typeof authConfig>,
  ) {}

  @Get()
  async check() {
    const [db, keycloak] = await Promise.all([
      this.checkDb(),
      this.checkKeycloak(),
    ]);
    const result = { status: db === 'ok' ? 'ok' : 'fail', db, keycloak };
    if (db !== 'ok') {
      throw new ServiceUnavailableException(result);
    }
    return result;
  }

  private async checkDb(): Promise<CheckStatus> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return 'ok';
    } catch {
      return 'fail';
    }
  }

  private async checkKeycloak(): Promise<CheckStatus> {
    if (!this.auth.keycloak.enabled) return 'disabled';
    try {
      const response = await fetch(this.auth.keycloak.jwksUri, {
        signal: AbortSignal.timeout(3000),
      });
      return response.ok ? 'ok' : 'fail';
    } catch {
      return 'fail';
    }
  }
}
