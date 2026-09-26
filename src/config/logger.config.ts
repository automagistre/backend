import type { Params } from 'nestjs-pino';
import type { IncomingMessage } from 'http';

export function getLoggerConfig(): Params {
  const dev = process.env.NODE_ENV === 'development';

  return {
    pinoHttp: {
      level: process.env.LOG_LEVEL ?? (dev ? 'debug' : 'info'),
      transport: dev
        ? { target: 'pino-pretty', options: { singleLine: true } }
        : undefined,
      autoLogging: {
        ignore: (req: IncomingMessage) =>
          req.url?.startsWith('/api/health') ?? false,
      },
      customProps: (req: IncomingMessage) => ({
        tenantId: req.headers['x-tenant-id'],
        tenantPublicId: req.headers['x-tenant-public-id'],
      }),
      serializers: {
        req: (req: { id: unknown; method: string; url: string }) => ({
          id: req.id,
          method: req.method,
          url: req.url,
        }),
        res: (res: { statusCode: number }) => ({ statusCode: res.statusCode }),
      },
    },
  };
}
