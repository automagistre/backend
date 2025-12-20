import { Args, ID, Mutation, Parent, Query, ResolveField, Resolver } from '@nestjs/graphql';
import { OrderItemService } from './order-item.service';
import { OrderItemModel } from './models/order-item.model';
import { CreateOrderItemGroupInput } from './inputs/create-order-item-group.input';
import { CreateOrderItemServiceInput } from './inputs/create-order-item-service.input';
import { CreateOrderItemPartInput } from './inputs/create-order-item-part.input';
import { EmployeeService } from '../employee/employee.service';
import { EmployeeModel } from '../employee/models/employee.model';

@Resolver(() => OrderItemModel)
export class OrderItemResolver {
  constructor(
    private readonly orderItemService: OrderItemService,
    private readonly employeeService: EmployeeService,
  ) {}

  @Query(() => [OrderItemModel], { name: 'orderItems', description: 'Элементы заказа в виде дерева' })
  async getOrderItems(@Args('orderId', { type: () => ID }) orderId: string) {
    return this.orderItemService.findTreeByOrderId(orderId);
  }

  @ResolveField(() => EmployeeModel, { nullable: true })
  async serviceWorker(@Parent() item: OrderItemModel): Promise<EmployeeModel | null> {
    // Резолвим worker для service внутри OrderItem
    // Проверяем наличие service (type может быть '1' или 'service' в зависимости от версии данных)
    if (!item.service) {
      return null;
    }
    
    // Если workerId не указан, возвращаем null
    // В workerId хранится personId, а не employeeId
    if (!item.service.workerId) {
      return null;
    }
    
    // Ищем сотрудника по personId (в workerId хранится UUID персоны)
    //TODO: переделать на поиск по employeeId
    const employee = await this.employeeService.findByPersonId(item.service.workerId);
    return employee as EmployeeModel | null;
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

