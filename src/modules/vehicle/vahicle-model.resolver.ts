import {
  Args,
  Mutation,
  Parent,
  Query,
  ResolveField,
  Resolver,
} from '@nestjs/graphql';
import { VehicleModelService } from './vehicle-model.service';
import { VehicleModel } from './models/vahicle.model';
import { CreateVehicleInput, UpdateVehicleInput } from './inputs/vehicle.input';
import { PaginationArgs } from 'src/common/pagination.args';
import { PaginatedVehicles } from './inputs/paginatedVehicles.type';
import { CurrentUserContext } from 'src/common/decorators/auth-context.decorator';
import { SkipTenant } from 'src/common/decorators/skip-tenant.decorator';
import type { UserContext } from 'src/common/user-id.store';
import { AppUserModel } from '../app-user/models/app-user.model';
import { AppUserLoader } from '../app-user/app-user.loader';

@Resolver(() => VehicleModel)
@SkipTenant()
export class VahicleModelResolver {
  constructor(
    private readonly vehicleModelService: VehicleModelService,
    private readonly appUserLoader: AppUserLoader,
  ) {}

  @ResolveField(() => AppUserModel, { nullable: true })
  async createdByUser(@Parent() vehicle: VehicleModel) {
    if (!vehicle.createdBy) return null;
    return this.appUserLoader.load(vehicle.createdBy);
  }

  @Query(() => PaginatedVehicles, {
    name: 'vehicles',
    description: 'Получить модели автомобилей с пагинацией',
  })
  async GetAllVehicles(
    @Args() pagination?: PaginationArgs,
    @Args('search', { nullable: true }) search?: string,
  ) {
    if (!pagination) {
      pagination = { take: undefined, skip: undefined };
    }
    const { take = 25, skip = 0 } = pagination;

    return this.vehicleModelService.findMany({
      take,
      skip,
      search,
    });
  }

  @Query(() => VehicleModel, {
    name: 'vehicle',
    description: 'Получить модель автомобиля по id',
  })
  async GetVehicle(@Args('id') id: string): Promise<VehicleModel | null> {
    return this.vehicleModelService.findOne(id);
  }

  @Mutation(() => VehicleModel, {
    name: 'createOneVehicle',
    description: 'Создать модель автомобиля',
  })
  async CreateOneVehicle(
    @CurrentUserContext() ctx: UserContext,
    @Args('data') data: CreateVehicleInput,
  ): Promise<VehicleModel> {
    return this.vehicleModelService.create(ctx, data);
  }

  @Mutation(() => VehicleModel, {
    name: 'updateOneVehicle',
    description: 'Обновить модель автомобиля',
  })
  async UpdateOneVehicle(
    @Args('data') data: UpdateVehicleInput,
  ): Promise<VehicleModel> {
    return this.vehicleModelService.update(data);
  }

  @Mutation(() => VehicleModel, {
    name: 'deleteOneVehicle',
    description: 'Удалить модель автомобиля',
  })
  async DeleteOneVehicle(@Args('id') id: string): Promise<VehicleModel> {
    return this.vehicleModelService.remove(id);
  }
}
