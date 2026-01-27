import { Injectable, ExecutionContext } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtAuthGuard } from './jwt-auth.guard';

/**
 * DevAuthGuard - условный guard для разработки
 *
 * В dev режиме (NODE_ENV !== 'production') полностью отключает авторизацию
 * и создает фиктивного пользователя для всех запросов.
 *
 * В production режиме работает как обычный JwtAuthGuard.
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
    // В dev режиме пропускаем все запросы без авторизации
    // Пользователь уже установлен в UserIdMiddleware
    const isDevMode =
      this.configService.get<string>('NODE_ENV') !== 'production';

    if (isDevMode) {
      return true;
    }

    // В production используем обычную авторизацию
    return super.canActivate(context);
  }
}
