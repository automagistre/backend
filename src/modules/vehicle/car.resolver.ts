import { Args, Mutation, Parent, Query, ResolveField, Resolver } from '@nestjs/graphql';
import { CarService } from './car.service';
import { CarModel, CarNumber, VehicleIdentifier } from './models/car.model';
import { VINScalar } from 'src/common/scalars/vin.scalar';
import { Car } from '@prisma/client';
import { GosNomerRUScalar } from 'src/common/scalars/gosnomer-ru.scalar';
import { CreateCarInput, CreateCarInputPrisma, UpdateCarInput, UpdateCarInputPrisma } from './inputs/car.input';
import { PaginationArgs } from 'src/common/pagination.args';
import { PaginatedCars } from './inputs/paginatedCar.type';

@Resolver(() => CarModel)
export class CarResolver {
  constructor(
    private readonly carService: CarService,
    private readonly vinScalar: VINScalar,
    private readonly gosnomerRUScalar: GosNomerRUScalar,
  ) {}

  private parseInput<T extends CreateCarInput | UpdateCarInput>(
    data: T,
  ): any {
    const { vin, frame, gosnomerRu, gosnomerOther, ...rest } = data as any;
    
    // Удаляем все null значения, чтобы Prisma использовала defaults
    const filtered = Object.fromEntries(
      Object.entries(rest).filter(([_, value]) => value !== null)
    );
    
    // Обработка идентификатора: пустая строка → null для очистки
    let identifier = undefined;
    if (vin !== undefined) {
      identifier = (vin && vin.trim() !== '') ? vin : null;
    } else if (frame !== undefined) {
      identifier = (frame && frame.trim() !== '') ? frame : null;
    }
    
    // Обработка госномера: пустая строка → null для очистки
    let gosnomer = undefined;
    if (gosnomerRu !== undefined) {
      gosnomer = (gosnomerRu && gosnomerRu.trim() !== '') ? gosnomerRu : null;
    } else if (gosnomerOther !== undefined) {
      gosnomer = (gosnomerOther && gosnomerOther.trim() !== '') ? gosnomerOther : null;
    }
    
    const result: any = { ...filtered };
    
    // Добавляем поля только если они определены
    if (identifier !== undefined) {
      result.identifier = identifier;
    }
    if (gosnomer !== undefined) {
      result.gosnomer = gosnomer;
    }
    
    return result;
  }

  @Query(() => PaginatedCars)
  async cars(
    @Args() pagination?: PaginationArgs,
    @Args('search', { nullable: true }) search?: string,
  ) {
    if (!pagination) {
      pagination = { take: undefined, skip: undefined };
    }
    const { take = 25, skip = 0 } = pagination;

    const itemsPaginated = await this.carService.findMany({
      take,
      skip,
      search,
    });
    return itemsPaginated;
  }

  @Query(() => CarModel, { nullable: true })
  async car(@Args('id') id: string): Promise<CarModel | null> {
    return (await this.carService.findById(id)) as CarModel;
  }

  @Query(() => CarModel, { nullable: true })
  async carByIdentifier(@Args('identifier') identifier: string): Promise<CarModel | null> {
    return (await this.carService.findByIdentifier(identifier)) as CarModel;
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
