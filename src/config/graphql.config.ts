import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { ConfigService } from '@nestjs/config';
import { join } from 'path';
import { isDev } from '../utils/is-dev.util';

// eslint-disable-next-line @typescript-eslint/require-await
export async function getGraphQLConfig(
  configService: ConfigService,
): Promise<ApolloDriverConfig> {
  return {
    driver: ApolloDriver,
    autoSchemaFile: join(process.cwd(), 'src/schema.gql'),
    path: '/api/graphql',
    sortSchema: true,
    playground: isDev(configService),
    subscriptions: {
      'graphql-ws': {
        path: '/api/graphql',
      },
    },

    context: ({ req, res, extra, connectionParams }: any) => {
      // Для WebSocket подписок создаём pseudo-request с заголовками из connectionParams и cookies
      if (!req && (extra || connectionParams)) {
        const params = connectionParams || {};
        const headers = params.headers || {};
        const authorization = headers.Authorization || headers.authorization || params.authorization || params.Authorization || '';
        
        // Tenant из connectionParams
        let tenantId = headers['x-tenant-id'] || headers['X-Tenant-Id'] || params['x-tenant-id'] || params['X-Tenant-Id'] || '';
        
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
        res,
      };
    },
  };
}
