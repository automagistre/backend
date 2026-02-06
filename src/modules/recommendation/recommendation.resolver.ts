import { Inject } from '@nestjs/common';
import {
  Args,
  ID,
  Mutation,
  Parent,
  Query,
  ResolveField,
  Resolver,
  Subscription,
} from '@nestjs/graphql';
import { PubSub } from 'graphql-subscriptions';
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
import { applyDefaultCurrency } from 'src/common/money';
import { SettingsService } from '../settings/settings.service';

@Resolver(() => CarRecommendationModel)
export class RecommendationResolver {
  constructor(
    private readonly recommendationService: RecommendationService,
    private readonly employeeService: EmployeeService,
    private readonly carService: CarService,
    private readonly settingsService: SettingsService,
    @Inject('PUB_SUB') private readonly pubSub: PubSub,
  ) {}

  private async publishCarRecommendationsUpdated(carId: string): Promise<void> {
    const recommendations = await this.recommendationService.findByCarId(carId);
    await this.pubSub.publish(`CAR_RECOMMENDATIONS_UPDATED_${carId}`, {
      carRecommendationsUpdated: recommendations,
      carId,
    });
  }

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
    const workerId =
      (await this.employeeService.resolvePersonIdByWorkerId(input.workerId)) ??
      input.workerId;
    const defaultCurrency = await this.settingsService.getDefaultCurrencyCode();
    const priceData = input.price
      ? applyDefaultCurrency(input.price, defaultCurrency)
      : { amountMinor: 0n, currencyCode: defaultCurrency };
    const result = await this.recommendationService.createRecommendation({
      carId: input.carId,
      service: input.service.trim(),
      workerId,
      expiredAt: input.expiredAt ?? null,
      priceAmount: priceData.amountMinor,
      priceCurrencyCode: priceData.currencyCode,
    });
    await this.publishCarRecommendationsUpdated(input.carId);
    return result as any;
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
      data.workerId =
        (await this.employeeService.resolvePersonIdByWorkerId(input.workerId)) ??
        input.workerId;
    }
    if (input.expiredAt !== undefined) {
      data.expiredAt = input.expiredAt;
    }
    if (input.price !== undefined) {
      const defaultCurrency = await this.settingsService.getDefaultCurrencyCode();
      const priceData = applyDefaultCurrency(input.price, defaultCurrency);
      data.priceAmount = priceData.amountMinor;
      data.priceCurrencyCode = priceData.currencyCode;
    }

    const result = await this.recommendationService.updateRecommendation({ id: input.id, ...data });
    if (result.carId) {
      await this.publishCarRecommendationsUpdated(result.carId);
    }
    return result as any;
  }

  @Mutation(() => Boolean, {
    name: 'deleteCarRecommendation',
    description: 'Удалить рекомендацию по автомобилю',
  })
  async deleteCarRecommendation(@Args('id', { type: () => ID }) id: string) {
    // Получаем carId до удаления для публикации события
    const recommendation = await this.recommendationService.findById(id);
    const carId = recommendation?.carId;
    
    const result = await this.recommendationService.deleteRecommendation(id);
    if (carId) {
      await this.publishCarRecommendationsUpdated(carId);
    }
    return result;
  }

  @Mutation(() => CarRecommendationPartModel, {
    name: 'createCarRecommendationPart',
    description: 'Добавить запчасть к рекомендации',
  })
  async createCarRecommendationPart(
    @Args('input') input: CreateCarRecommendationPartInput,
  ) {
    const defaultCurrency = await this.settingsService.getDefaultCurrencyCode();
    const priceData = input.price
      ? applyDefaultCurrency(input.price, defaultCurrency)
      : { amountMinor: 0n, currencyCode: defaultCurrency };
    const result = await this.recommendationService.createRecommendationPart({
      recommendationId: input.recommendationId,
      partId: input.partId,
      quantity: input.quantity,
      priceAmount: priceData.amountMinor,
      priceCurrencyCode: priceData.currencyCode,
    });
    // Получаем carId через рекомендацию
    const recommendation = await this.recommendationService.findById(input.recommendationId);
    if (recommendation?.carId) {
      await this.publishCarRecommendationsUpdated(recommendation.carId);
    }
    return result as any;
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
    if (input.price !== undefined) {
      const defaultCurrency = await this.settingsService.getDefaultCurrencyCode();
      const priceData = applyDefaultCurrency(input.price, defaultCurrency);
      data.priceAmount = priceData.amountMinor;
      data.priceCurrencyCode = priceData.currencyCode;
    }

    const result = await this.recommendationService.updateRecommendationPart({ id: input.id, ...data });
    // Публикуем через recommendationId
    if (result.recommendationId) {
      const recommendation = await this.recommendationService.findById(result.recommendationId);
      if (recommendation?.carId) {
        await this.publishCarRecommendationsUpdated(recommendation.carId);
      }
    }
    return result as any;
  }

  @Mutation(() => Boolean, {
    name: 'deleteCarRecommendationPart',
    description: 'Удалить запчасть из рекомендации',
  })
  async deleteCarRecommendationPart(@Args('id', { type: () => ID }) id: string) {
    // Получаем carId до удаления
    const part = await this.recommendationService.findRecommendationPartById(id);
    const carId = part?.recommendation?.carId;
    
    const result = await this.recommendationService.deleteRecommendationPart(id);
    if (carId) {
      await this.publishCarRecommendationsUpdated(carId);
    }
    return result;
  }

  @ResolveField(() => EmployeeModel, { nullable: true })
  async worker(@Parent() rec: CarRecommendationModel): Promise<EmployeeModel | null> {
    if (!rec.workerId) return null;
    // В старых данных workerId может быть либо employee.id, либо personId (как в работах заказа).
    // Причина: таблица рекомендаций не имеет FK на employee/person, и в миграциях это могло отличаться.
    return (await this.employeeService.resolveEmployeeByWorkerId(rec.workerId)) as any;
  }

  @ResolveField(() => CarModel, { nullable: true })
  async car(@Parent() rec: CarRecommendationModel): Promise<CarModel | null> {
    if (!rec.carId) return null;
    return (await this.carService.findById(rec.carId)) as any;
  }

  @Subscription(() => [CarRecommendationModel], {
    filter: (payload, variables) => {
      // Подписка фильтруется по carId
      const recommendations = payload.carRecommendationsUpdated;
      if (!recommendations || recommendations.length === 0) {
        return variables.carId === payload.carId;
      }
      return recommendations.some((r: any) => r.carId === variables.carId);
    },
  })
  async carRecommendationsUpdated(@Args('carId', { type: () => ID }) carId: string) {
    return this.pubSub.asyncIterableIterator(`CAR_RECOMMENDATIONS_UPDATED_${carId}`);
  }
}

