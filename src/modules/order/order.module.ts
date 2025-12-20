import { Module } from '@nestjs/common';
import { OrderService } from './order.service';
import { OrderResolver } from './order.resolver';
import { OrderItemService } from './order-item.service';
import { OrderItemResolver } from './order-item.resolver';
import { PubSub } from 'graphql-subscriptions';

@Module({
  providers: [
    OrderService,
    OrderResolver,
    OrderItemService,
    OrderItemResolver,
    {
      provide: 'PUB_SUB',
      useValue: new PubSub(),
    },
  ],
  exports: [OrderService, OrderItemService, 'PUB_SUB'],
})
export class OrderModule {}

