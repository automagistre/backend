import { Injectable, NestMiddleware } from '@nestjs/common';
import { FastifyRequest, FastifyReply } from 'fastify';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class UserIdMiddleware implements NestMiddleware {
  constructor(private prisma: PrismaService) {}

  async use(req: FastifyRequest, res: FastifyReply, next: () => void) {
    const userId = '24602e10-629b-4f23-8d8b-1cca08fb8a84';
    await this.prisma.$executeRawUnsafe(`SET app.user_id = '${userId}'`);

    next();
  }
}
