import {
  Args,
  ID,
  Int,
  Mutation,
  Parent,
  Query,
  ResolveField,
  Resolver,
} from '@nestjs/graphql';
import { AuthContext } from 'src/common/decorators/auth-context.decorator';
import { RequireTenant } from 'src/common/decorators/skip-tenant.decorator';
import type { AuthContext as AuthContextType } from 'src/common/user-id.store';
import { AppUserLoader } from '../app-user/app-user.loader';
import { AppUserModel } from '../app-user/models/app-user.model';
import { PersonService } from '../person/person.service';
import { PersonModel } from '../person/models/person.model';
import { OrganizationService } from '../organization/organization.service';
import { OrganizationModel } from '../organization/models/organization.model';
import { CounterpartyUnion } from '../supplier/supplier.union';
import { CarService } from '../vehicle/car.service';
import { CarModel } from '../vehicle/models/car.model';
import { OrderService } from '../order/order.service';
import { OrderModel } from '../order/models/order.model';
import { TireStorageStatus } from './enums/tire-storage-status.enum';
import { CreateTireStorageInput } from './inputs/create-tire-storage.input';
import { UpdateTireStorageInput } from './inputs/update-tire-storage.input';
import { TireStorageModel } from './models/tire-storage.model';
import { TireStorageService } from './tire-storage.service';
import { PaginatedTireStorages } from './types/paginated-tire-storages.type';
import './enums/tire-storage-status.enum';
import './enums/tire-season.enum';

@Resolver(() => TireStorageModel)
@RequireTenant()
export class TireStorageResolver {
  constructor(
    private readonly tireStorageService: TireStorageService,
    private readonly personService: PersonService,
    private readonly organizationService: OrganizationService,
    private readonly carService: CarService,
    private readonly orderService: OrderService,
    private readonly appUserLoader: AppUserLoader,
  ) {}

  @Query(() => PaginatedTireStorages, {
    name: 'tireStorages',
    description:
      'Список договоров хранения (фильтры: customerId, status, overdueOnly, search)',
  })
  async tireStorages(
    @AuthContext() ctx: AuthContextType,
    @Args('skip', { type: () => Int, nullable: true }) skip?: number,
    @Args('take', { type: () => Int, nullable: true }) take?: number,
    @Args('customerId', { type: () => ID, nullable: true })
    customerId?: string,
    @Args('orderId', { type: () => ID, nullable: true }) orderId?: string,
    @Args('status', { type: () => TireStorageStatus, nullable: true })
    status?: TireStorageStatus,
    @Args('overdueOnly', { type: () => Boolean, nullable: true })
    overdueOnly?: boolean,
    @Args('search', { type: () => String, nullable: true }) search?: string,
  ): Promise<PaginatedTireStorages> {
    return this.tireStorageService.findMany(ctx, {
      skip: skip ?? 0,
      take: take ?? 25,
      customerId,
      orderId,
      status,
      overdueOnly: overdueOnly ?? false,
      search,
    });
  }

  @Query(() => TireStorageModel, {
    name: 'tireStorage',
    description: 'Договор хранения по ID',
  })
  async tireStorage(
    @AuthContext() ctx: AuthContextType,
    @Args('id', { type: () => ID }) id: string,
  ): Promise<TireStorageModel> {
    return this.tireStorageService.findOne(ctx, id);
  }

  @Mutation(() => TireStorageModel, {
    name: 'createTireStorage',
    description: 'Ввести договор хранения в заказ (status=ENTERED)',
  })
  async createTireStorage(
    @AuthContext() ctx: AuthContextType,
    @Args('input') input: CreateTireStorageInput,
  ): Promise<TireStorageModel> {
    return this.tireStorageService.create(ctx, input);
  }

  @Mutation(() => TireStorageModel, {
    name: 'updateTireStorage',
    description: 'Обновить введённый договор или ручную опись на складе',
  })
  async updateTireStorage(
    @AuthContext() ctx: AuthContextType,
    @Args('input') input: UpdateTireStorageInput,
  ): Promise<TireStorageModel> {
    return this.tireStorageService.update(ctx, input);
  }

  @Mutation(() => TireStorageModel, {
    name: 'closeTireStorage',
    description:
      'Закрыть договор хранения (IN_WAREHOUSE | AWAITING_SHOP | IN_SHOP → CLOSED)',
  })
  async closeTireStorage(
    @AuthContext() ctx: AuthContextType,
    @Args('id', { type: () => ID }) id: string,
  ): Promise<TireStorageModel> {
    return this.tireStorageService.close(ctx, id);
  }

  @Mutation(() => TireStorageModel, {
    name: 'requestShopTireStorage',
    description: 'Заявить комплект к выдаче (IN_WAREHOUSE → AWAITING_SHOP)',
  })
  async requestShopTireStorage(
    @AuthContext() ctx: AuthContextType,
    @Args('id', { type: () => ID }) id: string,
  ): Promise<TireStorageModel> {
    return this.tireStorageService.requestShop(ctx, id);
  }

  @Mutation(() => TireStorageModel, {
    name: 'cancelShopRequestTireStorage',
    description: 'Отменить заявку на выдачу (AWAITING_SHOP → IN_WAREHOUSE)',
  })
  async cancelShopRequestTireStorage(
    @AuthContext() ctx: AuthContextType,
    @Args('id', { type: () => ID }) id: string,
  ): Promise<TireStorageModel> {
    return this.tireStorageService.cancelShopRequest(ctx, id);
  }

  @Mutation(() => TireStorageModel, {
    name: 'moveTireStorageToShop',
    description: 'Переместить комплект в цех (AWAITING_SHOP → IN_SHOP)',
  })
  async moveTireStorageToShop(
    @AuthContext() ctx: AuthContextType,
    @Args('id', { type: () => ID }) id: string,
  ): Promise<TireStorageModel> {
    return this.tireStorageService.moveToShop(ctx, id);
  }

  @Mutation(() => TireStorageModel, {
    name: 'returnTireStorageFromShop',
    description: 'Вернуть комплект из цеха на склад (IN_SHOP → IN_WAREHOUSE)',
  })
  async returnTireStorageFromShop(
    @AuthContext() ctx: AuthContextType,
    @Args('id', { type: () => ID }) id: string,
  ): Promise<TireStorageModel> {
    return this.tireStorageService.returnFromShop(ctx, id);
  }

  @Mutation(() => TireStorageModel, {
    name: 'disposeTireStorage',
    description:
      'Утилизировать комплект (IN_WAREHOUSE | AWAITING_SHOP | IN_SHOP → DISPOSED)',
  })
  async disposeTireStorage(
    @AuthContext() ctx: AuthContextType,
    @Args('id', { type: () => ID }) id: string,
  ): Promise<TireStorageModel> {
    return this.tireStorageService.dispose(ctx, id);
  }

  @Mutation(() => Boolean, {
    name: 'deleteTireStorage',
    description:
      'Удалить введённый договор или ручную опись на складе (без заказа)',
  })
  async deleteTireStorage(
    @AuthContext() ctx: AuthContextType,
    @Args('id', { type: () => ID }) id: string,
  ): Promise<boolean> {
    return this.tireStorageService.remove(ctx, id);
  }

  @ResolveField(() => CounterpartyUnion, { nullable: true })
  async customer(
    @AuthContext() ctx: AuthContextType,
    @Parent() storage: TireStorageModel,
  ): Promise<PersonModel | OrganizationModel | null> {
    const person = await this.personService.findOne(ctx, storage.customerId);
    if (person) return person as PersonModel;
    const org = await this.organizationService.findOne(ctx, storage.customerId);
    return org as OrganizationModel | null;
  }

  @ResolveField(() => CarModel, { nullable: true })
  async car(
    @AuthContext() ctx: AuthContextType,
    @Parent() storage: TireStorageModel,
  ): Promise<CarModel | null> {
    if (!storage.carId) return null;
    return (await this.carService.findById(ctx, storage.carId)) as any;
  }

  @ResolveField(() => OrderModel, { nullable: true })
  async order(
    @AuthContext() ctx: AuthContextType,
    @Parent() storage: TireStorageModel,
  ): Promise<OrderModel | null> {
    if (!storage.orderId) return null;
    return (await this.orderService.findOne(ctx, storage.orderId)) as any;
  }

  @ResolveField(() => AppUserModel, { nullable: true })
  async createdByUser(@Parent() storage: TireStorageModel) {
    if (!storage.createdBy) return null;
    return this.appUserLoader.load(storage.createdBy);
  }

  @ResolveField(() => AppUserModel, { nullable: true })
  async closedByUser(@Parent() storage: TireStorageModel) {
    if (!storage.closedById) return null;
    return this.appUserLoader.load(storage.closedById);
  }
}
