import {
  Args,
  Mutation,
  Parent,
  Query,
  ResolveField,
  Resolver,
} from '@nestjs/graphql';
import { CarService } from './car.service';
import { CarModel, CarNumber, VehicleIdentifier } from './models/car.model';
import { VINScalar } from 'src/common/scalars/vin.scalar';
import { Car } from '@prisma/client';
import { GosNomerRUScalar } from 'src/common/scalars/gosnomer-ru.scalar';
import {
  CreateCarInput,
  CreateCarInputPrisma,
  UpdateCarInput,
  UpdateCarInputPrisma,
} from './inputs/car.input';
import { PaginationArgs } from 'src/common/pagination.args';
import { PaginatedCars } from './inputs/paginatedCar.type';

@Resolver(() => CarModel)
export class CarResolver {
  constructor(
    private readonly carService: CarService,
    private readonly vinScalar: VINScalar,
    private readonly gosnomerRUScalar: GosNomerRUScalar,
  ) {}

  private parseInput<T extends CreateCarInput | UpdateCarInput>(data: T): any {
    const { vin, frame, gosnomerRu, gosnomerOther, ...rest } = data as any;

    // Удаляем все null значения, чтобы Prisma использовала defaults
    const filtered = Object.fromEntries(
      Object.entries(rest).filter(([_, value]) => value !== null),
    );

    // Обработка идентификатора: приоритет заполненному полю
    let identifier: string | null | undefined = undefined;
    // Проверяем сначала, какое из полей заполнено
    if (vin !== undefined && vin !== null && vin.trim() !== '') {
      identifier = vin;
    } else if (frame !== undefined && frame !== null && frame.trim() !== '') {
      identifier = frame;
    } else if (vin !== undefined || frame !== undefined) {
      // Если одно из полей передано, но пустое/null - очищаем identifier
      identifier = null;
    }
    // Если оба undefined - не трогаем (identifier остается undefined и не обновляется)

    // Обработка госномера: приоритет заполненному полю
    let gosnomer: string | null | undefined = undefined;
    if (
      gosnomerRu !== undefined &&
      gosnomerRu !== null &&
      gosnomerRu.trim() !== ''
    ) {
      gosnomer = gosnomerRu;
    } else if (
      gosnomerOther !== undefined &&
      gosnomerOther !== null &&
      gosnomerOther.trim() !== ''
    ) {
      gosnomer = gosnomerOther;
    } else if (gosnomerRu !== undefined || gosnomerOther !== undefined) {
      // Если одно из полей передано, но пустое/null - очищаем gosnomer
      gosnomer = null;
    }
    // Если оба undefined - не трогаем (gosnomer остается undefined и не обновляется)

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
  async carByIdentifier(
    @Args('identifier') identifier: string,
  ): Promise<CarModel | null> {
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
