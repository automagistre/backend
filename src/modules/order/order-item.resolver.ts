import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import { OrderItemService } from './order-item.service';
import { OrderItemModel } from './models/order-item.model';
import { CreateOrderItemGroupInput } from './inputs/create-order-item-group.input';
import { CreateOrderItemServiceInput } from './inputs/create-order-item-service.input';
import { CreateOrderItemPartInput } from './inputs/create-order-item-part.input';

@Resolver(() => OrderItemModel)
export class OrderItemResolver {
  constructor(private readonly orderItemService: OrderItemService) {}

  @Query(() => [OrderItemModel], { name: 'orderItems', description: 'Элементы заказа в виде дерева' })
  async getOrderItems(@Args('orderId', { type: () => ID }) orderId: string) {
    return this.orderItemService.findTreeByOrderId(orderId);
  }

  @Mutation(() => OrderItemModel, { name: 'createOrderItemGroup', description: 'Создать группу элементов заказа' })
  async createOrderItemGroup(@Args('input') input: CreateOrderItemGroupInput) {
    return this.orderItemService.createGroup(input);
  }

  @Mutation(() => OrderItemModel, { name: 'createOrderItemService', description: 'Создать услугу в заказе' })
  async createOrderItemService(@Args('input') input: CreateOrderItemServiceInput) {
    return this.orderItemService.createService(input);
  }

  @Mutation(() => OrderItemModel, { name: 'createOrderItemPart', description: 'Создать запчасть в заказе' })
  async createOrderItemPart(@Args('input') input: CreateOrderItemPartInput) {
    return this.orderItemService.createPart(input);
  }

  @Mutation(() => OrderItemModel, { name: 'deleteOrderItem', description: 'Удалить элемент заказа' })
  async deleteOrderItem(@Args('id', { type: () => ID }) id: string) {
    return this.orderItemService.delete(id);
  }
}

