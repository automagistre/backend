import {
  Args,
  ID,
  Mutation,
  Parent,
  Query,
  ResolveField,
  Resolver,
} from '@nestjs/graphql';
import { Inject, Logger } from '@nestjs/common';
import { PubSub } from 'graphql-subscriptions';
import { AuthContext } from 'src/common/decorators/auth-context.decorator';
import { RequireTenant } from 'src/common/decorators/skip-tenant.decorator';
import type { AuthContext as AuthContextType } from 'src/common/user-id.store';
import { EmployeeService } from '../employee/employee.service';
import { PersonService } from '../person/person.service';
import { CarService } from '../vehicle/car.service';
import { CalendarService } from './calendar.service';
import {
  CalendarEntryCreateSource,
  CreateCalendarEntryInput,
  DeleteCalendarEntryInput,
  UpdateCalendarEntryInput,
} from './inputs/calendarEntry.input';
import { CalendarEntryModel } from './models/calendar-entry.model';
import { CalendarEntryOrderInfoModel } from './models/calendar-entry-order-info.model';
import { CalendarEntryScheduleModel } from './models/calendar-entry-schedule.model';
import { EmployeeModel } from '../employee/models/employee.model';
import { PersonModel } from '../person/models/person.model';
import { CarModel } from '../vehicle/models/car.model';
import { OrderModel } from '../order/models/order.model';
import { OrderService } from '../order/order.service';
import { OrderStatus } from '../order/enums/order-status.enum';

@Resolver(() => CalendarEntryModel)
@RequireTenant()
export class CalendarResolver {
  private readonly logger = new Logger(CalendarResolver.name);

  constructor(
    private readonly calendarService: CalendarService,
    private readonly orderService: OrderService,
    @Inject('PUB_SUB') private readonly pubSub: PubSub,
  ) {}

  @Query(() => CalendarEntryModel, {
    nullable: true,
    name: 'calendarEntry',
    description: 'Запись календаря по ID',
  })
  async getCalendarEntry(
    @AuthContext() ctx: AuthContextType,
    @Args('id', { type: () => ID }) id: string,
  ): Promise<CalendarEntryModel | null> {
    return (await this.calendarService.getEntry(
      ctx,
      id,
    )) as CalendarEntryModel | null;
  }

  @Query(() => [CalendarEntryModel], {
    name: 'calendarEntriesByDate',
    description: 'Список записей календаря за день',
  })
  async getCalendarEntriesByDate(
    @AuthContext() ctx: AuthContextType,
    @Args('date', { type: () => Date }) date: Date,
  ): Promise<CalendarEntryModel[]> {
    return (await this.calendarService.getEntriesByDate(
      ctx,
      date,
    )) as CalendarEntryModel[];
  }

  @Mutation(() => CalendarEntryModel, {
    name: 'createCalendarEntry',
    description: 'Создать запись календаря',
  })
  async createCalendarEntry(
    @AuthContext() ctx: AuthContextType,
    @Args('input') input: CreateCalendarEntryInput,
  ): Promise<CalendarEntryModel> {
    const created = (await this.calendarService.createEntry(
      ctx,
      input,
    )) as CalendarEntryModel;

    if (
      input.orderId &&
      (input.source ?? CalendarEntryCreateSource.CALENDAR_FLOW) ===
        CalendarEntryCreateSource.ORDER_FLOW
    ) {
      try {
        const updated = await this.orderService.update(ctx, {
          id: input.orderId,
          status: OrderStatus.SCHEDULING,
        });
        await this.pubSub.publish(`ORDER_UPDATED_${input.orderId}`, {
          orderUpdated: {
            ...updated,
            orderId: input.orderId,
          },
        });
      } catch (error) {
        this.logger.warn(
          `Не удалось обновить статус заказа ${input.orderId} после создания записи`,
          error instanceof Error ? error.stack : undefined,
        );
      }
    }

    return created;
  }

  @Mutation(() => CalendarEntryModel, {
    nullable: true,
    name: 'updateCalendarEntry',
    description: 'Обновить запись календаря',
  })
  async updateCalendarEntry(
    @AuthContext() ctx: AuthContextType,
    @Args('input') input: UpdateCalendarEntryInput,
  ): Promise<CalendarEntryModel | null> {
    return (await this.calendarService.updateEntry(
      ctx,
      input,
    )) as CalendarEntryModel | null;
  }

  @Mutation(() => Boolean, {
    name: 'deleteCalendarEntry',
    description: 'Удалить запись календаря',
  })
  async deleteCalendarEntry(
    @AuthContext() ctx: AuthContextType,
    @Args('input') input: DeleteCalendarEntryInput,
  ): Promise<boolean> {
    await this.calendarService.deleteEntry(ctx, input);
    return true;
  }

  @ResolveField(() => CalendarEntryScheduleModel, { nullable: true })
  schedule(
    @Parent() entry: CalendarEntryModel,
  ): CalendarEntryScheduleModel | null {
    return entry.calendarEntrySchedule?.[0] ?? null;
  }

  @ResolveField(() => CalendarEntryOrderInfoModel, { nullable: true })
  orderInfo(
    @Parent() entry: CalendarEntryModel,
  ): CalendarEntryOrderInfoModel | null {
    return entry.calendarEntryOrderInfo?.[0] ?? null;
  }

  @ResolveField(() => OrderModel, { nullable: true })
  async order(
    @AuthContext() ctx: AuthContextType,
    @Parent() entry: CalendarEntryModel,
  ): Promise<OrderModel | null> {
    return this.calendarService.getOrderForEntry(
      ctx,
      entry.id,
    ) as Promise<OrderModel | null>;
  }
}

@Resolver(() => CalendarEntryOrderInfoModel)
@RequireTenant()
export class CalendarEntryOrderInfoResolver {
  constructor(
    private readonly employeeService: EmployeeService,
    private readonly personService: PersonService,
    private readonly carService: CarService,
  ) {}

  @ResolveField(() => PersonModel, { nullable: true })
  async customer(
    @AuthContext() ctx: AuthContextType,
    @Parent() orderInfo: CalendarEntryOrderInfoModel,
  ): Promise<PersonModel | null> {
    if (orderInfo.customer !== undefined) {
      return orderInfo.customer ?? null;
    }
    if (!orderInfo.customerId) {
      return null;
    }
    return (await this.personService.findOne(
      ctx,
      orderInfo.customerId,
    )) as PersonModel | null;
  }

  @ResolveField(() => CarModel, { nullable: true })
  async car(
    @AuthContext() ctx: AuthContextType,
    @Parent() orderInfo: CalendarEntryOrderInfoModel,
  ): Promise<CarModel | null> {
    if (!orderInfo.carId) {
      return null;
    }
    return (await this.carService.findById(
      ctx,
      orderInfo.carId,
    )) as CarModel | null;
  }

  @ResolveField(() => EmployeeModel, { nullable: true })
  async worker(
    @AuthContext() ctx: AuthContextType,
    @Parent() orderInfo: CalendarEntryOrderInfoModel,
  ): Promise<EmployeeModel | null> {
    if (!orderInfo.workerId) {
      return null;
    }
    return (await this.employeeService.resolveEmployeeByWorkerId(
      ctx,
      orderInfo.workerId,
    )) as EmployeeModel | null;
  }
}
