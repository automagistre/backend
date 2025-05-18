import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { GraphQLModule } from '@nestjs/graphql';
import { ManufacturerModule } from './entities/manufacturer/manufacturer.module';
import { PartModule } from './entities/part/part.module';
import { ApolloDriver } from '@nestjs/apollo';
import { PrismaModule } from './prisma/prisma.module';
import { getGraphQLConfig } from './config/graphql.config';
import { UserIdMiddleware } from './middlewares/user-id.middleware';
import { BigIntScalar } from './common/scalars/bigint.scalar';
import { PersonModule } from './entities/person/person.module';
import { VehicleModelModule } from './entities/vehicle/vehicle-model.module';


@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    GraphQLModule.forRootAsync({
      driver: ApolloDriver,
      imports: [ConfigModule],
      useFactory: getGraphQLConfig,
      inject: [ConfigService],
    }),
    PrismaModule,
    ManufacturerModule,
    PartModule,
    PersonModule,
    VehicleModelModule,
  ],
  providers: [UserIdMiddleware, BigIntScalar],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(UserIdMiddleware)
      .forRoutes('*');
  }
}
