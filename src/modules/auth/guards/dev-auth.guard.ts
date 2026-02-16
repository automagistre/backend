import { Injectable, ExecutionContext } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtAuthGuard } from './jwt-auth.guard';

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
      return true;
    }
    return super.canActivate(context);
  }
}
