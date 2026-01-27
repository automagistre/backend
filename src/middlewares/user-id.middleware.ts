import { Injectable, NestMiddleware } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FastifyRequest, FastifyReply } from 'fastify';
import { PrismaService } from 'src/prisma/prisma.service';

const DEV_USER_ID = '24602e10-629b-4f23-8d8b-1cca08fb8a84';
const DEV_USER_EMAIL = 'dev@example.com';
const DEFAULT_TENANT_ID = '1ec13d33-3f41-6e3a-a0cb-02420a000f18';

@Injectable()
export class UserIdMiddleware implements NestMiddleware {
  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {}

  async use(req: FastifyRequest, res: FastifyReply, next: () => void) {
    const isDevMode =
      this.configService.get<string>('NODE_ENV') !== 'production';

    let userId: string;

    if (isDevMode) {
      // В dev режиме используем дефолтный UUID и устанавливаем фиктивного пользователя
      userId = DEV_USER_ID;
      (req as any).user = {
        sub: userId,
        email: DEV_USER_EMAIL,
      };
    } else {
      // В production получаем UUID из авторизованного пользователя (установленного guard'ом)
      const user = (req as any).user;
      userId = user?.sub;

      // В production режиме пользователь должен быть установлен guard'ом
      if (!userId) {
        // Не бросаем ошибку здесь, пусть guard'ы решают вопросы авторизации
        // Просто не устанавливаем user_id в базу
        next();
        return;
      }
    }

    await this.prisma.$executeRawUnsafe(`SET app.user_id = '${userId}'`);
    await this.prisma.$executeRawUnsafe(
      `SET app.tenant_id = '${DEFAULT_TENANT_ID}'`,
    );

    next();
  }
}
