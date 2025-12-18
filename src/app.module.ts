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
import { CommonModule } from './common/common.module';
import { PersonModule } from './modules/person/person.module';
import { CarModule } from './modules/vehicle/car.module';
import { CalendarModule } from './modules/calendar/calendar.module';
import { OrganizationModule } from './modules/organization/organization.module';
import { EmployeeModule } from './modules/employee/employee.module';
import { APP_GUARD } from '@nestjs/core';
import { AuthModule } from './modules/auth/auth.module';
import { DevAuthGuard } from './modules/auth/guards/dev-auth.guard';
import { Reflector } from '@nestjs/core';
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
    CommonModule,
    ManufacturerModule,
    PartModule,
    PersonModule,
    CarModule,
    OrganizationModule,
    EmployeeModule,
    CalendarModule,
    AuthModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useFactory: (reflector: Reflector, configService: ConfigService) => {
        return new DevAuthGuard(reflector, configService);
      },
      inject: [Reflector, ConfigService],
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
