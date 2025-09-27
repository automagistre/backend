import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { GraphQLModule } from '@nestjs/graphql';
import { ManufacturerModule } from './modules/manufacturer/manufacturer.module';
import { PartModule } from './modules/part/part.module';
import { ApolloDriver } from '@nestjs/apollo';
import { PrismaModule } from './prisma/prisma.module';
import { getGraphQLConfig } from './config/graphql.config';
import { UserIdMiddleware } from './middlewares/user-id.middleware';
import { BigIntScalar } from './common/scalars/bigint.scalar';
import { PersonModule } from './modules/person/person.module';
import { CarModule } from './modules/vehicle/car.module';
import { CalendarModule } from './modules/calendar/calendar.module';
import { APP_GUARD } from '@nestjs/core';
import { AuthModule } from './modules/auth/auth.module';
import { JwtAuthGuard } from './modules/auth/guards/jwt-auth.guard';
import authConfig from './config/auth.config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [authConfig],
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
    CarModule,
    CalendarModule,
    AuthModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    UserIdMiddleware,
    BigIntScalar,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(UserIdMiddleware).forRoutes('*');
  }
}
