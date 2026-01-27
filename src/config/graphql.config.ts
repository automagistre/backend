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

    context: ({ req, res, extra }: any) => ({
      req: req ?? extra?.request,
      res,
    }),
  };
}
