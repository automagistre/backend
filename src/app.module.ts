import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { GraphQLModule } from '@nestjs/graphql';
import { ManufacturerModule } from './modules/manufacturer/manufacturer.module';
import { PartModule } from './modules/part/part.module';
import { WarehouseModule } from './modules/warehouse/warehouse.module';
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
import { OrderModule } from './modules/order/order.module';
import { ReservationModule } from './modules/reservation/reservation.module';
import { ServiceModule } from './modules/service/service.module';
import { RecommendationModule } from './modules/recommendation/recommendation.module';
import { RecommendationMigrationModule } from './modules/recommendation-migration/recommendation-migration.module';
import { WalletModule } from './modules/wallet/wallet.module';
import { CustomerTransactionModule } from './modules/customer-transaction/customer-transaction.module';
import { SalaryModule } from './modules/salary/salary.module';
import { SettingsModule } from './modules/settings/settings.module';
import { NoteModule } from './modules/note/note.module';
import { AppealModule } from './modules/appeal/appeal.module';
import { SupplierModule } from './modules/supplier/supplier.module';
import { IncomeModule } from './modules/income/income.module';
import { ExpenseModule } from './modules/expense/expense.module';
import { ReviewModule } from './modules/review/review.module';
import { McModule } from './modules/mc/mc.module';
import { DevAuthGuard } from './modules/auth/guards/dev-auth.guard';
import { Reflector } from '@nestjs/core';
import authConfig from './config/auth.config';

@Module({
  imports: [
    ScheduleModule.forRoot(),
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
    WarehouseModule,
    PartModule,
    PersonModule,
    CarModule,
    OrganizationModule,
    EmployeeModule,
    CalendarModule,
    AuthModule,
    OrderModule,
    ReservationModule,
    ServiceModule,
    RecommendationModule,
    RecommendationMigrationModule,
    WalletModule,
    CustomerTransactionModule,
    SalaryModule,
    SettingsModule,
    NoteModule,
    AppealModule,
    SupplierModule,
    IncomeModule,
    ExpenseModule,
    ReviewModule,
    McModule,
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
