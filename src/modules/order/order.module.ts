import { Module, forwardRef } from '@nestjs/common';
import { OrderService } from './order.service';
import {
  OrderResolver,
  OrderSubscriptionResolver,
  OrderPaymentResolver,
  OrderSuspendResolver,
} from './order.resolver';
import { OrderItemService } from './order-item.service';
import { OrderItemResolver } from './order-item.resolver';
import {
  OrderItemPartResolver,
  OrderItemServiceResolver,
  OrderItemGroupResolver,
} from './order-item-part.resolver';
import { PubSub } from 'graphql-subscriptions';
import { CarModule } from '../vehicle/car.module';
import { PersonModule } from '../person/person.module';
import { OrganizationModule } from '../organization/organization.module';
import { EmployeeModule } from '../employee/employee.module';
import { ReservationModule } from '../reservation/reservation.module';
import { WarehouseModule } from '../warehouse/warehouse.module';
import { WalletModule } from '../wallet/wallet.module';
import { SalaryModule } from '../salary/salary.module';
import { CustomerTransactionModule } from '../customer-transaction/customer-transaction.module';
import { TasksModule } from '../tasks/tasks.module';
import { RecommendationMigrationModule } from '../recommendation-migration/recommendation-migration.module';
import './enums/order-item-type.enum';
import './enums/close-deficiency.enum';

@Module({
  imports: [
    CarModule,
    PersonModule,
    OrganizationModule,
    EmployeeModule,
    forwardRef(() => ReservationModule),
    forwardRef(() => WarehouseModule),
    WalletModule,
    SalaryModule,
    CustomerTransactionModule,
    TasksModule,
    forwardRef(() => RecommendationMigrationModule),
  ],
  providers: [
    OrderService,
    OrderResolver,
    OrderSubscriptionResolver,
    OrderItemService,
    OrderItemResolver,
    OrderItemPartResolver,
    OrderItemServiceResolver,
    OrderItemGroupResolver,
    OrderPaymentResolver,
    OrderSuspendResolver,
    {
      provide: 'PUB_SUB',
      useValue: new PubSub(),
    },
  ],
  exports: [OrderService, OrderItemService, 'PUB_SUB'],
})
export class OrderModule {}
