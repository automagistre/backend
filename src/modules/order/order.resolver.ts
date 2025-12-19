import { Args, ID, Query, Resolver } from '@nestjs/graphql';
import { OrderService } from './order.service';
import { OrderModel } from './models/order.model';

@Resolver(() => OrderModel)
export class OrderResolver {
  constructor(private readonly orderService: OrderService) {}

  @Query(() => OrderModel, { nullable: true, name: 'order', description: 'Заказ по ID' })
  async getOrder(@Args('id', { type: () => ID }) id: string): Promise<OrderModel | null> {
    return this.orderService.findOne(id);
  }

  @Query(() => [OrderModel], { name: 'orders', description: 'Список всех заказов' })
  async getOrders(): Promise<OrderModel[]> {
    return this.orderService.findAll();
  }
}

