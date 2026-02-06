import { Module, forwardRef } from '@nestjs/common';
import { OrderService } from './order.service';
import { OrderResolver } from './order.resolver';
import { OrderItemService } from './order-item.service';
import { OrderItemResolver } from './order-item.resolver';
import { OrderItemPartResolver } from './order-item-part.resolver';
import { PubSub } from 'graphql-subscriptions';
import { CarModule } from '../vehicle/car.module';
import { PersonModule } from '../person/person.module';
import { EmployeeModule } from '../employee/employee.module';
import { ReservationModule } from '../reservation/reservation.module';
import { WarehouseModule } from '../warehouse/warehouse.module';
import { WalletModule } from '../wallet/wallet.module';
import { SalaryModule } from '../salary/salary.module';
import { CustomerTransactionModule } from '../customer-transaction/customer-transaction.module';
import './enums/order-item-type.enum';

@Module({
  imports: [
    CarModule,
    PersonModule,
    EmployeeModule,
    forwardRef(() => ReservationModule),
    WarehouseModule,
    WalletModule,
    SalaryModule,
    CustomerTransactionModule,
  ],
  providers: [
    OrderService,
    OrderResolver,
    OrderItemService,
    OrderItemResolver,
    OrderItemPartResolver,
    {
      provide: 'PUB_SUB',
      useValue: new PubSub(),
    },
  ],
  exports: [OrderService, OrderItemService, 'PUB_SUB'],
})
export class OrderModule {}
