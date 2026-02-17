import { Injectable, NestMiddleware } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FastifyRequest, FastifyReply } from 'fastify';

const DEV_USER_ID = '24602e10-629b-4f23-8d8b-1cca08fb8a84';
const DEV_USER_EMAIL = 'dev@automagistre.ru';

/**
 * В dev (skipAuthCheck) устанавливает req.user. SET app.user_id делает UserIdInterceptor.
 */
@Injectable()
export class UserIdMiddleware implements NestMiddleware {
  constructor(private configService: ConfigService) {}

  use(req: FastifyRequest, _res: FastifyReply, next: () => void): void {
    if (this.configService.get<boolean>('auth.skipCheck') !== true) {
      next();
      return;
    }
    (req as { user?: { sub: string; email: string } }).user = {
      sub: DEV_USER_ID,
      email: DEV_USER_EMAIL,
    };
    next();
  }
}
