import {
  Args,
  ID,
  Mutation,
  Parent,
  Query,
  ResolveField,
  Resolver,
} from '@nestjs/graphql';
import { RecommendationService } from './recommendation.service';
import { CarRecommendationModel } from './models/car-recommendation.model';
import { CreateCarRecommendationInput } from './inputs/create-car-recommendation.input';
import { UpdateCarRecommendationInput } from './inputs/update-car-recommendation.input';
import { CreateCarRecommendationPartInput } from './inputs/create-car-recommendation-part.input';
import { UpdateCarRecommendationPartInput } from './inputs/update-car-recommendation-part.input';
import { EmployeeService } from '../employee/employee.service';
import { EmployeeModel } from '../employee/models/employee.model';
import { CarService } from '../vehicle/car.service';
import { CarModel } from '../vehicle/models/car.model';
import { CarRecommendationPartModel } from './models/car-recommendation-part.model';
import {
  normalizeMoneyAmount,
  rubCurrencyCode,
} from 'src/common/utils/money.util';

@Resolver(() => CarRecommendationModel)
export class RecommendationResolver {
  constructor(
    private readonly recommendationService: RecommendationService,
    private readonly employeeService: EmployeeService,
    private readonly carService: CarService,
  ) {}

  @Query(() => [CarRecommendationModel], {
    name: 'carRecommendations',
    description: 'Список рекомендаций по автомобилю (для отображения в заказах и карточке авто)',
  })
  async carRecommendations(
    @Args('carId', { type: () => ID }) carId: string,
  ): Promise<CarRecommendationModel[]> {
    return this.recommendationService.findByCarId(carId) as any;
  }

  @Mutation(() => CarRecommendationModel, {
    name: 'createCarRecommendation',
    description: 'Создать рекомендацию по автомобилю',
  })
  async createCarRecommendation(@Args('input') input: CreateCarRecommendationInput) {
    return this.recommendationService.createRecommendation({
      carId: input.carId,
      service: input.service.trim(),
      workerId: input.workerId,
      expiredAt: input.expiredAt ?? null,
      priceAmount: normalizeMoneyAmount(input.priceAmount),
      priceCurrencyCode: input.priceCurrencyCode ?? rubCurrencyCode(),
    }) as any;
  }

  @Mutation(() => CarRecommendationModel, {
    name: 'updateCarRecommendation',
    description: 'Обновить рекомендацию по автомобилю',
  })
  async updateCarRecommendation(@Args('input') input: UpdateCarRecommendationInput) {
    const data: any = {};
    if (input.service !== undefined && input.service !== null) {
      data.service = input.service.trim();
    }
    if (input.workerId !== undefined) {
      data.workerId = input.workerId;
    }
    if (input.expiredAt !== undefined) {
      data.expiredAt = input.expiredAt;
    }
    if (input.priceAmount !== undefined) {
      data.priceAmount = normalizeMoneyAmount(input.priceAmount);
    }
    if (input.priceCurrencyCode !== undefined) {
      data.priceCurrencyCode = input.priceCurrencyCode ?? rubCurrencyCode();
    }

    return this.recommendationService.updateRecommendation({ id: input.id, ...data }) as any;
  }

  @Mutation(() => Boolean, {
    name: 'deleteCarRecommendation',
    description: 'Удалить рекомендацию по автомобилю',
  })
  async deleteCarRecommendation(@Args('id', { type: () => ID }) id: string) {
    return this.recommendationService.deleteRecommendation(id);
  }

  @Mutation(() => CarRecommendationPartModel, {
    name: 'createCarRecommendationPart',
    description: 'Добавить запчасть к рекомендации',
  })
  async createCarRecommendationPart(
    @Args('input') input: CreateCarRecommendationPartInput,
  ) {
    return this.recommendationService.createRecommendationPart({
      recommendationId: input.recommendationId,
      partId: input.partId,
      quantity: input.quantity,
      priceAmount: normalizeMoneyAmount(input.priceAmount),
      priceCurrencyCode: input.priceCurrencyCode ?? rubCurrencyCode(),
    }) as any;
  }

  @Mutation(() => CarRecommendationPartModel, {
    name: 'updateCarRecommendationPart',
    description: 'Обновить запчасть рекомендации',
  })
  async updateCarRecommendationPart(
    @Args('input') input: UpdateCarRecommendationPartInput,
  ) {
    const data: any = {};
    if (input.quantity !== undefined && input.quantity !== null) {
      data.quantity = input.quantity;
    }
    if (input.priceAmount !== undefined) {
      data.priceAmount = normalizeMoneyAmount(input.priceAmount);
    }
    if (input.priceCurrencyCode !== undefined) {
      data.priceCurrencyCode = input.priceCurrencyCode ?? rubCurrencyCode();
    }

    return this.recommendationService.updateRecommendationPart({ id: input.id, ...data }) as any;
  }

  @Mutation(() => Boolean, {
    name: 'deleteCarRecommendationPart',
    description: 'Удалить запчасть из рекомендации',
  })
  async deleteCarRecommendationPart(@Args('id', { type: () => ID }) id: string) {
    return this.recommendationService.deleteRecommendationPart(id);
  }

  @ResolveField(() => EmployeeModel, { nullable: true })
  async worker(@Parent() rec: CarRecommendationModel): Promise<EmployeeModel | null> {
    if (!rec.workerId) return null;
    // В старых данных workerId может быть либо employee.id, либо personId (как в работах заказа).
    // Причина: таблица рекомендаций не имеет FK на employee/person, и в миграциях это могло отличаться.
    const byPerson = await this.employeeService.findByPersonId(rec.workerId);
    if (byPerson) return byPerson as any;
    return (await this.employeeService.findOne(rec.workerId)) as any;
  }

  @ResolveField(() => CarModel, { nullable: true })
  async car(@Parent() rec: CarRecommendationModel): Promise<CarModel | null> {
    if (!rec.carId) return null;
    return (await this.carService.findById(rec.carId)) as any;
  }
}

