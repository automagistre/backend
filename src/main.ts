import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { AppModule } from './app.module';
import type { FastifyInstance } from 'fastify';

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter(),
  );

  app.enableCors();

  registerWwwGateway(app.getHttpAdapter().getInstance() as FastifyInstance);

  await app.listen(3000, '0.0.0.0');
}

/**
 * Регистрирует короткий публичный путь `POST /api/www/:publicId`,
 * который внутри делает inject в стандартный `/api/v1/graphql`
 * с подменённым заголовком `X-Tenant-Public-Id`. Так фронт сайта www
 * стучит по человекочитаемому URL (без UUID), а сам GraphQL обрабатывает
 * запрос как обычно — TenantGuard разруливает publicId через TenantService.
 */
function registerWwwGateway(fastify: FastifyInstance): void {
  fastify.route({
    method: 'POST',
    url: '/api/www/:publicId',
    handler: async (request, reply) => {
      const { publicId } = request.params as { publicId: string };
      const headers = { ...request.headers, 'x-tenant-public-id': publicId };
      delete (headers as Record<string, unknown>)['content-length'];

      const response = await fastify.inject({
        method: 'POST',
        url: '/api/v1/graphql',
        headers: headers as unknown as Record<string, string>,
        payload: request.body as unknown as string,
      });

      reply
        .status(response.statusCode)
        .headers(response.headers)
        .send(response.body);
    },
  });
}

bootstrap().catch((err) => {
  console.error('Error during application bootstrap:', err);
});
