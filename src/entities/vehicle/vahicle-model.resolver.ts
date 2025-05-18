import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { VehicleModelService } from './vehicle-model.service';
import { VehicleModel } from './models/vahicle.model';
import { CreateVehicleInput, UpdateVehicleInput } from './inputs/vehicle.input';

@Resolver()
export class VahicleModelResolver {
  constructor(private readonly vehicleModelService: VehicleModelService) {}

  @Query(() => [VehicleModel], { name: 'vehicles', description: 'Получить все модели автомобилей' })
  async GetAllVehicles(): Promise<VehicleModel[]> {
    return this.vehicleModelService.findAll();
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
