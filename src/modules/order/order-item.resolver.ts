import { Inject } from '@nestjs/common';
import {
  Args,
  ID,
  Mutation,
  Parent,
  Query,
  ResolveField,
  Resolver,
} from '@nestjs/graphql';
import { OrderItemService } from './order-item.service';
import { OrderItemModel } from './models/order-item.model';
import { CreateOrderItemGroupInput } from './inputs/create-order-item-group.input';
import { CreateOrderItemServiceInput } from './inputs/create-order-item-service.input';
import { CreateOrderItemPartInput } from './inputs/create-order-item-part.input';
import { UpdateOrderItemPartInput } from './inputs/update-order-item-part.input';
import { UpdateOrderItemServiceInput } from './inputs/update-order-item-service.input';
import { EmployeeService } from '../employee/employee.service';
import { EmployeeModel } from '../employee/models/employee.model';
import { OrderService } from './order.service';
import { PubSub } from 'graphql-subscriptions';
import { AuthContext } from 'src/common/decorators/auth-context.decorator';
import { RequireTenant } from 'src/common/decorators/skip-tenant.decorator';
import type { AuthContext as AuthContextType } from 'src/common/user-id.store';

@Resolver(() => OrderItemModel)
@RequireTenant()
export class OrderItemResolver {
  constructor(
    private readonly orderItemService: OrderItemService,
    private readonly employeeService: EmployeeService,
    private readonly orderService: OrderService,
    @Inject('PUB_SUB') private readonly pubSub: PubSub,
  ) {}

  private async publishOrderUpdated(
    ctx: AuthContextType,
    orderId: string,
  ): Promise<void> {
    const order = await this.orderService.findOne(ctx, orderId);
    if (!order) {
      return;
    }

    await this.pubSub.publish(`ORDER_UPDATED_${orderId}`, {
      orderUpdated: {
        ...order,
        orderId,
      },
    });
  }

  @Query(() => [OrderItemModel], {
    name: 'orderItems',
    description: 'Элементы заказа в виде дерева',
  })
  async getOrderItems(@Args('orderId', { type: () => ID }) orderId: string) {
    return this.orderItemService.findTreeByOrderId(orderId);
  }

  @ResolveField(() => EmployeeModel, { nullable: true })
  async serviceWorker(
    @AuthContext() ctx: AuthContextType,
    @Parent() item: OrderItemModel,
  ): Promise<EmployeeModel | null> {
    if (!item.service?.workerId) {
      return null;
    }
    const employee = await this.employeeService.findByPersonId(
      ctx,
      item.service.workerId,
    );
    return employee as EmployeeModel | null;
  }

  @Mutation(() => OrderItemModel, {
    name: 'createOrderItemGroup',
    description: 'Создать группу элементов заказа',
  })
  async createOrderItemGroup(
    @AuthContext() ctx: AuthContextType,
    @Args('input') input: CreateOrderItemGroupInput,
  ) {
    const created = await this.orderItemService.createGroup(ctx, input);
    if (created.orderId) {
      await this.publishOrderUpdated(ctx, created.orderId);
    }
    return created;
  }

  @Mutation(() => OrderItemModel, {
    name: 'createOrderItemService',
    description: 'Создать услугу в заказе',
  })
  async createOrderItemService(
    @AuthContext() ctx: AuthContextType,
    @Args('input') input: CreateOrderItemServiceInput,
  ) {
    const created = await this.orderItemService.createService(ctx, input);
    if (created.orderId) {
      await this.publishOrderUpdated(ctx, created.orderId);
    }
    return created;
  }

  @Mutation(() => OrderItemModel, {
    name: 'createOrderItemPart',
    description: 'Создать запчасть в заказе',
  })
  async createOrderItemPart(
    @AuthContext() ctx: AuthContextType,
    @Args('input') input: CreateOrderItemPartInput,
  ) {
    const created = await this.orderItemService.createPart(ctx, input);
    if (created.orderId) {
      await this.publishOrderUpdated(ctx, created.orderId);
    }
    return created;
  }

  @Mutation(() => OrderItemModel, {
    name: 'updateOrderItemPart',
    description: 'Обновить запчасть в заказе',
  })
  async updateOrderItemPart(
    @AuthContext() ctx: AuthContextType,
    @Args('input') input: UpdateOrderItemPartInput,
  ) {
    const updated = await this.orderItemService.updatePart(ctx, input);
    if (updated.orderId) {
      await this.publishOrderUpdated(ctx, updated.orderId);
    }
    return updated;
  }

  @Mutation(() => OrderItemModel, {
    name: 'updateOrderItemService',
    description: 'Обновить услугу в заказе',
  })
  async updateOrderItemService(
    @AuthContext() ctx: AuthContextType,
    @Args('input') input: UpdateOrderItemServiceInput,
  ) {
    const updated = await this.orderItemService.updateService(ctx, input);
    if (updated.orderId) {
      await this.publishOrderUpdated(ctx, updated.orderId);
    }
    return updated;
  }

  @Mutation(() => OrderItemModel, {
    name: 'deleteOrderItem',
    description: 'Удалить элемент заказа',
  })
  async deleteOrderItem(
    @AuthContext() ctx: AuthContextType,
    @Args('id', { type: () => ID }) id: string,
    @Args('deleteChildren', {
      type: () => Boolean,
      nullable: true,
      defaultValue: true,
      description:
        'Удалить дочерние элементы (по умолчанию true). Если false - дочерние элементы перемещаются в корень.',
    })
    deleteChildren?: boolean,
  ) {
    const deleted = await this.orderItemService.delete(ctx, id, deleteChildren);
    if (deleted.orderId) {
      await this.publishOrderUpdated(ctx, deleted.orderId);
    }
    return deleted;
  }
}
