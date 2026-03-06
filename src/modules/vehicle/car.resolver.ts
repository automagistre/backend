import {
  Args,
  Int,
  Mutation,
  Parent,
  Query,
  ResolveField,
  Resolver,
} from '@nestjs/graphql';
import { CarService } from './car.service';
import { CarModel, CarNumber, VehicleIdentifier } from './models/car.model';
import { VINScalar } from 'src/common/scalars/vin.scalar';
import { Car } from 'src/generated/prisma/client';
import { GosNomerRUScalar } from 'src/common/scalars/gosnomer-ru.scalar';
import { CreateCarInput, UpdateCarInput } from './inputs/car.input';
import { PaginationArgs } from 'src/common/pagination.args';
import { PaginatedCars } from './inputs/paginatedCar.type';
import { AuthContext } from 'src/common/decorators/auth-context.decorator';
import { RequireTenant } from 'src/common/decorators/skip-tenant.decorator';
import type { AuthContext as AuthContextType } from 'src/common/user-id.store';
import { PersonModel } from 'src/modules/person/models/person.model';
import { CustomerCarRelationService } from 'src/modules/customer-car-relation/customer-car-relation.service';

@Resolver(() => CarModel)
@RequireTenant()
export class CarResolver {
  constructor(
    private readonly carService: CarService,
    private readonly customerCarRelationService: CustomerCarRelationService,
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
    @AuthContext() ctx: AuthContextType,
    @Args() pagination?: PaginationArgs,
    @Args('search', { nullable: true }) search?: string,
  ) {
    if (!pagination) {
      pagination = { take: undefined, skip: undefined };
    }
    const { take = 25, skip = 0 } = pagination;

    return this.carService.findMany(ctx, { take, skip, search });
  }

  @Query(() => CarModel, { nullable: true })
  async car(
    @AuthContext() ctx: AuthContextType,
    @Args('id') id: string,
  ): Promise<CarModel | null> {
    return (await this.carService.findById(ctx, id)) as CarModel;
  }

  @Query(() => CarModel, { nullable: true })
  async carByIdentifier(
    @AuthContext() ctx: AuthContextType,
    @Args('identifier') identifier: string,
  ): Promise<CarModel | null> {
    return (await this.carService.findByIdentifier(
      ctx,
      identifier,
    )) as CarModel;
  }

  @Mutation(() => CarModel, { name: 'createOneCar' })
  async create(
    @AuthContext() ctx: AuthContextType,
    @Args('input') input: CreateCarInput,
  ): Promise<CarModel> {
    return (await this.carService.create(
      ctx,
      this.parseInput(input),
    )) as CarModel;
  }

  @Mutation(() => CarModel, { name: 'updateOneCar' })
  async update(
    @AuthContext() ctx: AuthContextType,
    @Args('input') input: UpdateCarInput,
  ): Promise<CarModel> {
    return (await this.carService.update(
      ctx,
      this.parseInput(input),
    )) as CarModel;
  }

  @Mutation(() => CarModel, { name: 'deleteOneCar' })
  async delete(
    @AuthContext() ctx: AuthContextType,
    @Args('id') id: string,
  ): Promise<CarModel> {
    return (await this.carService.delete(ctx, id)) as CarModel;
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

  @ResolveField(() => [PersonModel], {
    description: 'Клиенты автомобиля по истории заказов',
  })
  async persons(
    @AuthContext() ctx: AuthContextType,
    @Parent() car: CarModel,
    @Args('search', { nullable: true }) search?: string,
    @Args('take', { type: () => Int, nullable: true }) take?: number,
  ): Promise<PersonModel[]> {
    return (await this.customerCarRelationService.findCustomersByCarId(
      ctx,
      car.id,
      { search, take },
    )) as PersonModel[];
  }
}
