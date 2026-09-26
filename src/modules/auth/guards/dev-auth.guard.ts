import { Injectable, ExecutionContext } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtAuthGuard } from './jwt-auth.guard';
import {
  DEV_USER_EMAIL,
  DEV_USER_ID,
} from 'src/middlewares/user-id.middleware';

/**
 * DevAuthGuard - условный guard с отключаемой проверкой
 *
 * При AUTH_SKIP_CHECK=true — пропускает все запросы без проверки токена.
 * При AUTH_SKIP_CHECK=false или не задано — проверяет токен через Keycloak (token-introspection).
 */
@Injectable()
export class DevAuthGuard extends JwtAuthGuard {
  constructor(
    reflector: any,
    private readonly configService: ConfigService,
  ) {
    super(reflector);
  }

  canActivate(context: ExecutionContext) {
    const skipCheck = this.configService.get<boolean>('auth.skipCheck');
    if (skipCheck) {
      // Middleware пишет user в raw-запрос, а GraphQL-контекст видит FastifyRequest
      const req = this.getRequest(context) as {
        user?: unknown;
        raw?: { user?: unknown };
      };
      req.user ??= req.raw?.user ?? { sub: DEV_USER_ID, email: DEV_USER_EMAIL };
      return true;
    }
    return super.canActivate(context);
  }
}
