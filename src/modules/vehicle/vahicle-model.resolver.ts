import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { VehicleModelService } from './vehicle-model.service';
import { VehicleModel } from './models/vahicle.model';
import { CreateVehicleInput, UpdateVehicleInput } from './inputs/vehicle.input';
import { PaginationArgs } from 'src/common/pagination.args';
import { PaginatedVehicles } from './inputs/paginatedVehicles.type';

@Resolver(() => VehicleModel)
export class VahicleModelResolver {
  constructor(private readonly vehicleModelService: VehicleModelService) {}

  @Query(() => PaginatedVehicles, { name: 'vehicles', description: 'Получить модели автомобилей с пагинацией' })
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

  @Query(() => VehicleModel, { name: 'vehicle', description: 'Получить модель автомобиля по id' })
  async GetVehicle(@Args('id') id: string): Promise<VehicleModel | null> {
    return this.vehicleModelService.findOne(id);
  }

  @Mutation(() => VehicleModel, { name: 'createOneVehicle', description: 'Создать модель автомобиля' })
  async CreateOneVehicle(@Args('data') data: CreateVehicleInput): Promise<VehicleModel> {
    return this.vehicleModelService.create(data);
  }

  @Mutation(() => VehicleModel, { name: 'updateOneVehicle', description: 'Обновить модель автомобиля' })
  async UpdateOneVehicle(@Args('data') data: UpdateVehicleInput): Promise<VehicleModel> {
    return this.vehicleModelService.update(data);
  }

  @Mutation(() => VehicleModel, { name: 'deleteOneVehicle', description: 'Удалить модель автомобиля' })
  async DeleteOneVehicle(@Args('id') id: string): Promise<VehicleModel> {
    return this.vehicleModelService.remove(id);
  }
}
