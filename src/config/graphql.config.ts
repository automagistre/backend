import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { ConfigService } from '@nestjs/config';
import { join } from 'path';
import { isDev } from '../utils/is-dev.util';
import { depthLimit } from './graphql-depth-limit';

// eslint-disable-next-line @typescript-eslint/require-await
export async function getGraphQLConfig(
  configService: ConfigService,
): Promise<ApolloDriverConfig> {
  const dev = isDev(configService);
  const introspection = process.env.GRAPHQL_INTROSPECTION
    ? process.env.GRAPHQL_INTROSPECTION === 'true'
    : dev;

  return {
    driver: ApolloDriver,
    autoSchemaFile: join(process.cwd(), 'src/schema.gql'),
    path: '/api/v1/graphql',
    sortSchema: true,
    introspection,
    includeStacktraceInErrorResponses: dev,
    validationRules: [depthLimit(Number(process.env.GRAPHQL_MAX_DEPTH) || 15)],
    // GraphiQL вместо устаревшего Playground (баг с «залипающими» подсказками в Chrome 127+)
    graphiql: isDev(configService),
    playground: false,
    subscriptions: {
      'graphql-ws': {
        path: '/api/v1/graphql',
      },
    },

    // Fastify-интеграция Apollo вызывает context(request, reply)
    context: ({ req, res, extra, connectionParams }: any, reply?: unknown) => {
      // Для WebSocket подписок создаём pseudo-request с заголовками из connectionParams и cookies
      if (!req && (extra || connectionParams)) {
        const params = connectionParams || {};
        const headers = params.headers || {};
        const authorization =
          headers.Authorization ||
          headers.authorization ||
          params.authorization ||
          params.Authorization ||
          '';

        // Tenant из connectionParams
        let tenantId =
          headers['x-tenant-id'] ||
          headers['X-Tenant-Id'] ||
          params['x-tenant-id'] ||
          params['X-Tenant-Id'] ||
          '';

        // Если нет в connectionParams — читаем из cookie в upgrade request
        if (!tenantId && extra?.request?.headers?.cookie) {
          const cookieHeader = extra.request.headers.cookie;
          const match = cookieHeader.match(/X-Tenant-Id=([^;]+)/);
          if (match?.[1]) {
            tenantId = match[1];
          }
        }

        req = {
          headers: {
            authorization,
            'x-tenant-id': tenantId,
            cookie: extra?.request?.headers?.cookie || '',
          },
        };
      }

      return {
        req: req ?? extra?.request,
        res: res ?? reply,
      };
    },
  };
}
