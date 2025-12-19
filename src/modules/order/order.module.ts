import { Module } from '@nestjs/common';
import { OrderService } from './order.service';
import { OrderResolver } from './order.resolver';

@Module({
  providers: [OrderService, OrderResolver],
  exports: [OrderService],
})
export class OrderModule {}

