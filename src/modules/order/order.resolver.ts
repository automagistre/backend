import { Inject } from '@nestjs/common';
import { Args, ID, Parent, Query, ResolveField, Resolver, Subscription } from '@nestjs/graphql';
import { OrderService } from './order.service';
import { OrderModel } from './models/order.model';
import { OrderItemModel } from './models/order-item.model';
import { OrderItemService } from './order-item.service';
import { PubSub } from 'graphql-subscriptions';

@Resolver(() => OrderModel)
export class OrderResolver {
  constructor(
    private readonly orderService: OrderService,
    private readonly orderItemService: OrderItemService,
    @Inject('PUB_SUB') private readonly pubSub: PubSub,
  ) {}

  @Query(() => OrderModel, { nullable: true, name: 'order', description: 'Заказ по ID' })
  async getOrder(@Args('id', { type: () => ID }) id: string): Promise<OrderModel | null> {
    return this.orderService.findOne(id);
  }

  @Query(() => [OrderModel], { name: 'orders', description: 'Список всех заказов' })
  async getOrders(): Promise<OrderModel[]> {
    return this.orderService.findAll();
  }

  @ResolveField(() => [OrderItemModel])
  async items(@Parent() order: OrderModel): Promise<OrderItemModel[]> {
    return this.orderItemService.findTreeByOrderId(order.id);
  }

  @Subscription(() => OrderModel, {
    filter: (payload, variables) => payload.orderUpdated.orderId === variables.orderId,
  })
  async orderUpdated(@Args('orderId', { type: () => ID }) orderId: string) {
    return (this.pubSub as any).asyncIterator(`ORDER_UPDATED_${orderId}`);
  }
}

