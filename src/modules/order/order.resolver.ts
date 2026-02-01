import { Inject } from '@nestjs/common';
import {
  Args,
  ID,
  Parent,
  Query,
  ResolveField,
  Resolver,
  Subscription,
  Mutation,
} from '@nestjs/graphql';
import { OrderService } from './order.service';
import { OrderModel } from './models/order.model';
import { OrderItemModel } from './models/order-item.model';
import { OrderItemService } from './order-item.service';
import { PubSub } from 'graphql-subscriptions';
import { CarService } from '../vehicle/car.service';
import { PersonService } from '../person/person.service';
import { EmployeeService } from '../employee/employee.service';
import { CarModel } from '../vehicle/models/car.model';
import { PersonModel } from '../person/models/person.model';
import { EmployeeModel } from '../employee/models/employee.model';
import { UpdateOrderInput } from './inputs/update-order.input';
import { CreateOrderInput } from './inputs/create-order.input';
import { PaginationArgs } from 'src/common/pagination.args';
import { PaginatedOrders } from './inputs/paginatedOrders.type';
import { OrderStatus } from './enums/order-status.enum';

@Resolver(() => OrderModel)
export class OrderResolver {
  constructor(
    private readonly orderService: OrderService,
    private readonly orderItemService: OrderItemService,
    private readonly carService: CarService,
    private readonly personService: PersonService,
    private readonly employeeService: EmployeeService,
    @Inject('PUB_SUB') private readonly pubSub: PubSub,
  ) {}

  @Query(() => OrderModel, {
    nullable: true,
    name: 'order',
    description: 'Заказ по ID',
  })
  async getOrder(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<OrderModel | null> {
    return this.orderService.findOne(id);
  }

  @Query(() => PaginatedOrders, {
    name: 'orders',
    description: 'Список всех заказов с пагинацией',
  })
  async getOrders(
    @Args() pagination?: PaginationArgs,
    @Args('search', { nullable: true }) search?: string,
    @Args('status', { type: () => [OrderStatus], nullable: true })
    status?: OrderStatus[],
  ): Promise<PaginatedOrders> {
    if (!pagination) {
      pagination = { take: undefined, skip: undefined };
    }
    const { take = 25, skip = 0 } = pagination;
    return this.orderService.findMany({ take, skip, search, status });
  }

  @Query(() => [OrderModel], {
    name: 'activeOrders',
    description: 'Список активных заказов',
  })
  async getActiveOrders(
    @Args('search', { nullable: true }) search?: string,
    @Args('status', { type: () => [OrderStatus], nullable: true })
    status?: OrderStatus[],
  ): Promise<OrderModel[]> {
    return this.orderService.findActiveOrders({ search, status });
  }

  @Mutation(() => OrderModel, {
    name: 'createOrder',
    description: 'Создать заказ',
  })
  async createOrder(
    @Args('input') input: CreateOrderInput,
  ): Promise<OrderModel> {
    return this.orderService.create(input);
  }

  @Mutation(() => OrderModel, {
    name: 'updateOrder',
    description: 'Обновить заказ',
  })
  async updateOrder(
    @Args('input') input: UpdateOrderInput,
  ): Promise<OrderModel> {
    const updated = await this.orderService.update(input);

    await this.pubSub.publish(`ORDER_UPDATED_${input.id}`, {
      orderUpdated: {
        ...updated,
        orderId: input.id,
      },
    });

    return updated;
  }

  @ResolveField(() => [OrderItemModel])
  async items(@Parent() order: OrderModel): Promise<OrderItemModel[]> {
    return this.orderItemService.findTreeByOrderId(order.id);
  }

  @ResolveField(() => CarModel, { nullable: true })
  async car(@Parent() order: OrderModel): Promise<CarModel | null> {
    if (!order.carId) {
      return null;
    }
    return (await this.carService.findById(order.carId)) as CarModel | null;
  }

  @ResolveField(() => PersonModel, { nullable: true })
  async customer(@Parent() order: OrderModel): Promise<PersonModel | null> {
    if (!order.customerId) {
      return null;
    }
    return (await this.personService.findOne(
      order.customerId,
    )) as PersonModel | null;
  }

  @ResolveField(() => EmployeeModel, { nullable: true })
  async worker(@Parent() order: OrderModel): Promise<EmployeeModel | null> {
    if (!order.workerId) {
      return null;
    }
    return (await this.employeeService.findOne(
      order.workerId,
    )) as EmployeeModel | null;
  }

  @ResolveField(() => Date, { nullable: true })
  async closedAt(@Parent() order: OrderModel): Promise<Date | null> {
    return this.orderService.getClosedAt(order.id);
  }

  @Subscription(() => OrderModel, {
    filter: (payload, variables) =>
      payload.orderUpdated.orderId === variables.orderId,
  })
  async orderUpdated(@Args('orderId', { type: () => ID }) orderId: string) {
    // Причина: в текущей версии `graphql-subscriptions` используется `asyncIterableIterator`,
    // а не `asyncIterator` — иначе подписка падает при подключении по `graphql-ws`.
    return this.pubSub.asyncIterableIterator(`ORDER_UPDATED_${orderId}`);
  }
}
