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
import { OrderCloseValidationModel } from './models/order-close-validation.model';
import { OrderItemModel } from './models/order-item.model';
import { OrderItemService } from './order-item.service';
import { PubSub } from 'graphql-subscriptions';
import { CarService } from '../vehicle/car.service';
import { PersonService } from '../person/person.service';
import { OrganizationService } from '../organization/organization.service';
import { EmployeeService } from '../employee/employee.service';
import { CarModel } from '../vehicle/models/car.model';
import { PersonModel } from '../person/models/person.model';
import { OrganizationModel } from '../organization/models/organization.model';
import { EmployeeModel } from '../employee/models/employee.model';
import { CounterpartyUnion } from '../supplier/supplier.union';
import { WalletTransactionModel } from '../wallet/models/wallet-transaction.model';
import { OrderPaymentModel } from './models/order-payment.model';
import { CustomerTransactionModel } from '../customer-transaction/models/customer-transaction.model';
import { WalletTransactionService } from '../wallet/wallet-transaction.service';
import { CustomerTransactionService } from '../customer-transaction/customer-transaction.service';
import { UpdateOrderInput } from './inputs/update-order.input';
import { CreateOrderInput } from './inputs/create-order.input';
import { CreateOrderPrepayInput } from './inputs/create-order-prepay.input';
import { RefundOrderPrepayInput } from './inputs/refund-order-prepay.input';
import { CloseOrderInput } from './inputs/close-order.input';
import { PaginationArgs } from 'src/common/pagination.args';
import { PaginatedOrders } from './inputs/paginatedOrders.type';
import { OrderStatus } from './enums/order-status.enum';
import { AuthContext } from 'src/common/decorators/auth-context.decorator';
import {
  RequireTenant,
  SkipTenant,
} from 'src/common/decorators/skip-tenant.decorator';
import type { AuthContext as AuthContextType } from 'src/common/user-id.store';

@Resolver(() => OrderModel)
@RequireTenant()
export class OrderResolver {
  constructor(
    private readonly orderService: OrderService,
    private readonly orderItemService: OrderItemService,
    private readonly carService: CarService,
    private readonly organizationService: OrganizationService,
    private readonly personService: PersonService,
    private readonly employeeService: EmployeeService,
    private readonly walletTransactionService: WalletTransactionService,
    private readonly customerTransactionService: CustomerTransactionService,
    @Inject('PUB_SUB') private readonly pubSub: PubSub,
  ) {}

  @Query(() => OrderModel, {
    nullable: true,
    name: 'order',
    description: 'Заказ по ID',
  })
  async getOrder(
    @AuthContext() ctx: AuthContextType,
    @Args('id', { type: () => ID }) id: string,
  ): Promise<OrderModel | null> {
    return this.orderService.findOne(ctx, id);
  }

  @Query(() => PaginatedOrders, {
    name: 'orders',
    description: 'Список всех заказов с пагинацией',
  })
  async getOrders(
    @AuthContext() ctx: AuthContextType,
    @Args() pagination?: PaginationArgs,
    @Args('search', { nullable: true }) search?: string,
    @Args('status', { type: () => [OrderStatus], nullable: true })
    status?: OrderStatus[],
    @Args('customerId', { type: () => ID, nullable: true }) customerId?: string,
    @Args('carId', { type: () => ID, nullable: true }) carId?: string,
  ): Promise<PaginatedOrders> {
    if (!pagination) {
      pagination = { take: undefined, skip: undefined };
    }
    const { take = 25, skip = 0 } = pagination;
    return this.orderService.findMany(ctx, { take, skip, search, status, customerId, carId });
  }

  @Query(() => [OrderModel], {
    name: 'activeOrders',
    description: 'Список активных заказов',
  })
  async getActiveOrders(
    @AuthContext() ctx: AuthContextType,
    @Args('search', { nullable: true }) search?: string,
    @Args('status', { type: () => [OrderStatus], nullable: true })
    status?: OrderStatus[],
  ): Promise<OrderModel[]> {
    return this.orderService.findActiveOrders(ctx, { search, status });
  }

  @Mutation(() => OrderModel, {
    name: 'createOrder',
    description: 'Создать заказ',
  })
  async createOrder(
    @AuthContext() ctx: AuthContextType,
    @Args('input') input: CreateOrderInput,
  ): Promise<OrderModel> {
    return this.orderService.create(ctx, input);
  }

  @Mutation(() => WalletTransactionModel, {
    name: 'createOrderPrepay',
    description:
      'Создать предоплату по заказу (order_payment + проводка по кошельку в одной транзакции)',
  })
  async createOrderPrepay(
    @AuthContext() ctx: AuthContextType,
    @Args('input') input: CreateOrderPrepayInput,
  ): Promise<WalletTransactionModel> {
    return this.orderService.createPrepay(ctx, input);
  }

  @Mutation(() => WalletTransactionModel, {
    name: 'refundOrderPrepay',
    description:
      'Возврат предоплаты: order_payment с отрицательной суммой + проводка списания по выбранному счёту',
  })
  async refundOrderPrepay(
    @AuthContext() ctx: AuthContextType,
    @Args('input') input: RefundOrderPrepayInput,
  ): Promise<WalletTransactionModel> {
    return this.orderService.refundPrepay(ctx, input);
  }

  @Mutation(() => OrderModel, {
    name: 'closeOrder',
    description: 'Закрыть заказ',
  })
  async closeOrder(
    @AuthContext() ctx: AuthContextType,
    @Args('input') input: CloseOrderInput,
  ): Promise<OrderModel> {
    return this.orderService.closeOrder(ctx, input);
  }

  @Mutation(() => Boolean, {
    name: 'chargeOrderSalary',
    description:
      'Начислить зарплату по закрытому заказу. Проверяет, что заказ закрыт; идемпотентно по начислению.',
  })
  async chargeOrderSalary(
    @AuthContext() ctx: AuthContextType,
    @Args('orderId', { type: () => ID }) orderId: string,
  ): Promise<boolean> {
    await this.orderService.ensureOrderClosed(ctx, orderId);
    await this.orderService.chargeOrderSalary(ctx, orderId);
    return true;
  }

  @Mutation(() => OrderModel, {
    name: 'updateOrder',
    description: 'Обновить заказ',
  })
  async updateOrder(
    @AuthContext() ctx: AuthContextType,
    @Args('input') input: UpdateOrderInput,
  ): Promise<OrderModel> {
    const updated = await this.orderService.update(ctx, input);

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
  async car(
    @AuthContext() ctx: AuthContextType,
    @Parent() order: OrderModel,
  ): Promise<CarModel | null> {
    if (!order.carId) {
      return null;
    }
    return (await this.carService.findById(
      ctx,
      order.carId,
    )) as CarModel | null;
  }

  @ResolveField(() => CounterpartyUnion, { nullable: true })
  async customer(
    @AuthContext() ctx: AuthContextType,
    @Parent() order: OrderModel,
  ): Promise<PersonModel | OrganizationModel | null> {
    if (!order.customerId) return null;
    const person = await this.personService.findOne(ctx, order.customerId);
    if (person) return person as PersonModel;
    const org = await this.organizationService.findOne(ctx, order.customerId);
    return org as OrganizationModel | null;
  }

  @ResolveField(() => EmployeeModel, { nullable: true })
  async worker(
    @AuthContext() ctx: AuthContextType,
    @Parent() order: OrderModel,
  ): Promise<EmployeeModel | null> {
    if (!order.workerId) {
      return null;
    }
    return (await this.employeeService.findOne(
      ctx,
      order.workerId,
    )) as EmployeeModel | null;
  }

  @ResolveField(() => Date, { nullable: true })
  async closedAt(
    @AuthContext() ctx: AuthContextType,
    @Parent() order: OrderModel,
  ): Promise<Date | null> {
    return this.orderService.getClosedAt(ctx, order.id);
  }

  @ResolveField(() => Date, { nullable: true })
  async scheduledAt(
    @AuthContext() ctx: AuthContextType,
    @Parent() order: OrderModel,
  ): Promise<Date | null> {
    return this.orderService.getScheduledAt(ctx, order.id);
  }

  @ResolveField(() => Boolean)
  async canDelete(
    @AuthContext() ctx: AuthContextType,
    @Parent() order: OrderModel,
  ): Promise<boolean> {
    return this.orderService.canDeleteOrder(ctx, order.id);
  }

  @ResolveField(() => Boolean)
  async isEditable(
    @AuthContext() ctx: AuthContextType,
    @Parent() order: OrderModel,
  ): Promise<boolean> {
    return this.orderService.isOrderEditable(ctx, order.id);
  }

  @ResolveField(() => OrderCloseValidationModel)
  async closeValidation(
    @AuthContext() ctx: AuthContextType,
    @Parent() order: OrderModel,
  ): Promise<{ canClose: boolean; closeDeficiencies: string[] }> {
    return this.orderService.getCloseValidation(ctx, order.id);
  }

  @ResolveField(() => [OrderPaymentModel])
  async prepayments(
    @AuthContext() ctx: AuthContextType,
    @Parent() order: OrderModel,
  ): Promise<OrderPaymentModel[]> {
    return this.orderService.findPaymentsByOrderId(ctx, order.id);
  }

  @ResolveField(() => [WalletTransactionModel])
  async walletTransactions(
    @AuthContext() ctx: AuthContextType,
    @Parent() order: OrderModel,
  ): Promise<WalletTransactionModel[]> {
    return this.walletTransactionService.findByOrderId(ctx, order.id);
  }

  @ResolveField(() => [CustomerTransactionModel])
  async customerTransactions(
    @AuthContext() ctx: AuthContextType,
    @Parent() order: OrderModel,
  ): Promise<CustomerTransactionModel[]> {
    return this.customerTransactionService.findByOrderId(ctx, order.id);
  }

  @Mutation(() => Boolean, {
    name: 'deleteOrder',
    description: 'Удалить пустой заказ (в течение 3 ч с создания)',
  })
  async deleteOrder(
    @AuthContext() ctx: AuthContextType,
    @Args('id', { type: () => ID }) id: string,
  ): Promise<boolean> {
    return this.orderService.deleteOrder(ctx, id);
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
