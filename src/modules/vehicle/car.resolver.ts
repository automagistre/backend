import { Args, Mutation, Parent, Query, ResolveField, Resolver } from '@nestjs/graphql';
import { CarService } from './car.service';
import { CarModel, CarNumber, VehicleIdentifier } from './models/car.model';
import { VINScalar } from 'src/common/scalars/vin.scalar';
import { Car } from '@prisma/client';
import { GosNomerRUScalar } from 'src/common/scalars/gosnomer-ru.scalar';
import { CreateCarInput, CreateCarInputPrisma, UpdateCarInput, UpdateCarInputPrisma } from './inputs/car.input';

@Resolver(() => CarModel)
export class CarResolver {
  constructor(
    private readonly carService: CarService,
    private readonly vinScalar: VINScalar,
    private readonly gosnomerRUScalar: GosNomerRUScalar,
  ) {}

  private parseInput<T extends CreateCarInput | UpdateCarInput>(
    data: T,
  ): T & { identifier?: string; gosnomer?: string } {
    return {
      ...data,
      identifier: data?.vin || data?.frame || undefined,
      gosnomer: data?.gosnomerRu || data?.gosnomerOther || undefined,
    };
  }

  @Query(() => CarModel)
  async car(@Args('id') id: string): Promise<CarModel | null> {
    return (await this.carService.findById(id)) as CarModel;
  }

  @Mutation(() => CarModel, { name: 'createOneCar' })
  async create(@Args('input') input: CreateCarInput): Promise<CarModel> {
    return (await this.carService.create(this.parseInput(input))) as CarModel;
  }

  @Mutation(() => CarModel, { name: 'updateOneCar' })
  async update(@Args('input') input: UpdateCarInput): Promise<CarModel> {
    return (await this.carService.update(this.parseInput(input))) as CarModel;
  }

  @Mutation(() => CarModel, { name: 'deleteOneCar' })
  async delete(@Args('id') id: string): Promise<CarModel> {
    return (await this.carService.delete(id)) as CarModel;
  }

  @ResolveField(() => VehicleIdentifier)
  async identifier(@Parent() car: Car) {
    const resolverIdentifier: VehicleIdentifier = {
      vin: null,
      frame: null,
    };
    if (!car.identifier) {
      return null;
    }
    try {
      const vin = this.vinScalar.parseValue(car.identifier);
      resolverIdentifier.vin = vin;
    } catch {
      resolverIdentifier.frame = car.identifier;
    }
    return resolverIdentifier;
  }

  @ResolveField(() => CarNumber)
  async gosnomer(@Parent() car: Car) {
    const resolverGosnomer: CarNumber = {
      gosnomerRu: null,
      gosnomerOther: null,
    };
    if (!car.gosnomer) {
      return null;
    }
    try {
      const gosnomerRu = this.gosnomerRUScalar.parseValue(car.gosnomer);
      resolverGosnomer.gosnomerRu = gosnomerRu;
    } catch {
      resolverGosnomer.gosnomerOther = car.gosnomer;
    }
    return resolverGosnomer;
  }
}
