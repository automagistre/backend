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
import { AuthContext } from 'src/common/decorators/auth-context.decorator';
import { RequireTenant } from 'src/common/decorators/skip-tenant.decorator';
import type { AuthContext as AuthContextType } from 'src/common/user-id.store';
import { AppUserModel } from '../app-user/models/app-user.model';
import { AppUserLoader } from '../app-user/app-user.loader';

@Resolver(() => CarRecommendationModel)
@RequireTenant()
export class RecommendationResolver {
  constructor(
    private readonly recommendationService: RecommendationService,
    private readonly employeeService: EmployeeService,
    private readonly carService: CarService,
    private readonly settingsService: SettingsService,
    private readonly appUserLoader: AppUserLoader,
    @Inject('PUB_SUB') private readonly pubSub: PubSub,
  ) {}

  private async publishCarRecommendationsUpdated(
    ctx: AuthContextType,
    carId: string,
  ): Promise<void> {
    const recommendations = await this.recommendationService.findByCarId(
      ctx,
      carId,
    );
    await this.pubSub.publish(`CAR_RECOMMENDATIONS_UPDATED_${carId}`, {
      carRecommendationsUpdated: recommendations,
      carId,
    });
  }

  @Query(() => [CarRecommendationModel], {
    name: 'carRecommendations',
    description:
      'Список рекомендаций по автомобилю (для отображения в заказах и карточке авто)',
  })
  async carRecommendations(
    @AuthContext() ctx: AuthContextType,
    @Args('carId', { type: () => ID }) carId: string,
  ): Promise<CarRecommendationModel[]> {
    return this.recommendationService.findByCarId(ctx, carId) as any;
  }

  @Mutation(() => CarRecommendationModel, {
    name: 'createCarRecommendation',
    description: 'Создать рекомендацию по автомобилю',
  })
  async createCarRecommendation(
    @AuthContext() ctx: AuthContextType,
    @Args('input') input: CreateCarRecommendationInput,
  ) {
    const workerId =
      (await this.employeeService.resolvePersonIdByWorkerId(
        ctx,
        input.workerId,
      )) ?? input.workerId;
    const defaultCurrency = await this.settingsService.getDefaultCurrencyCode();
    const priceData = input.price
      ? applyDefaultCurrency(input.price, defaultCurrency)
      : { amountMinor: 0n, currencyCode: defaultCurrency };
    const result = await this.recommendationService.createRecommendation(ctx, {
      carId: input.carId,
      service: input.service.trim(),
      workerId,
      expiredAt: input.expiredAt ?? null,
      priceAmount: priceData.amountMinor,
      priceCurrencyCode: priceData.currencyCode,
    });
    await this.publishCarRecommendationsUpdated(ctx, input.carId);
    return result as any;
  }

  @Mutation(() => CarRecommendationModel, {
    name: 'updateCarRecommendation',
    description: 'Обновить рекомендацию по автомобилю',
  })
  async updateCarRecommendation(
    @AuthContext() ctx: AuthContextType,
    @Args('input') input: UpdateCarRecommendationInput,
  ) {
    const data: any = {};
    if (input.service !== undefined && input.service !== null) {
      data.service = input.service.trim();
    }
    if (input.workerId !== undefined) {
      data.workerId =
        (await this.employeeService.resolvePersonIdByWorkerId(
          ctx,
          input.workerId,
        )) ?? input.workerId;
    }
    if (input.expiredAt !== undefined) {
      data.expiredAt = input.expiredAt;
    }
    if (input.price !== undefined) {
      const defaultCurrency =
        await this.settingsService.getDefaultCurrencyCode();
      const priceData = applyDefaultCurrency(input.price, defaultCurrency);
      data.priceAmount = priceData.amountMinor;
      data.priceCurrencyCode = priceData.currencyCode;
    }

    const result = await this.recommendationService.updateRecommendation(ctx, {
      id: input.id,
      ...data,
    });
    if (result.carId) {
      await this.publishCarRecommendationsUpdated(ctx, result.carId);
    }
    return result as any;
  }

  @Mutation(() => Boolean, {
    name: 'deleteCarRecommendation',
    description: 'Удалить рекомендацию по автомобилю',
  })
  async deleteCarRecommendation(
    @AuthContext() ctx: AuthContextType,
    @Args('id', { type: () => ID }) id: string,
  ) {
    const recommendation = await this.recommendationService.findById(ctx, id);
    const carId = recommendation?.carId;

    const result = await this.recommendationService.deleteRecommendation(
      ctx,
      id,
    );
    if (carId) {
      await this.publishCarRecommendationsUpdated(ctx, carId);
    }
    return result;
  }

  @Mutation(() => CarRecommendationPartModel, {
    name: 'createCarRecommendationPart',
    description: 'Добавить запчасть к рекомендации',
  })
  async createCarRecommendationPart(
    @AuthContext() ctx: AuthContextType,
    @Args('input') input: CreateCarRecommendationPartInput,
  ) {
    const defaultCurrency = await this.settingsService.getDefaultCurrencyCode();
    const priceData = input.price
      ? applyDefaultCurrency(input.price, defaultCurrency)
      : { amountMinor: 0n, currencyCode: defaultCurrency };
    const result = await this.recommendationService.createRecommendationPart(
      ctx,
      {
        recommendationId: input.recommendationId,
        partId: input.partId,
        quantity: input.quantity,
        priceAmount: priceData.amountMinor,
        priceCurrencyCode: priceData.currencyCode,
      },
    );
    const recommendation = await this.recommendationService.findById(
      ctx,
      input.recommendationId,
    );
    if (recommendation?.carId) {
      await this.publishCarRecommendationsUpdated(ctx, recommendation.carId);
    }
    return result as any;
  }

  @Mutation(() => CarRecommendationPartModel, {
    name: 'updateCarRecommendationPart',
    description: 'Обновить запчасть рекомендации',
  })
  async updateCarRecommendationPart(
    @AuthContext() ctx: AuthContextType,
    @Args('input') input: UpdateCarRecommendationPartInput,
  ) {
    const data: any = {};
    if (input.partId !== undefined && input.partId !== null) {
      data.partId = input.partId;
    }
    if (input.quantity !== undefined && input.quantity !== null) {
      data.quantity = input.quantity;
    }
    if (input.price !== undefined) {
      const defaultCurrency =
        await this.settingsService.getDefaultCurrencyCode();
      const priceData = applyDefaultCurrency(input.price, defaultCurrency);
      data.priceAmount = priceData.amountMinor;
      data.priceCurrencyCode = priceData.currencyCode;
    }

    const result = await this.recommendationService.updateRecommendationPart(
      ctx,
      { id: input.id, ...data },
    );
    if (result.recommendationId) {
      const recommendation = await this.recommendationService.findById(
        ctx,
        result.recommendationId,
      );
      if (recommendation?.carId) {
        await this.publishCarRecommendationsUpdated(ctx, recommendation.carId);
      }
    }
    return result as any;
  }

  @Mutation(() => Boolean, {
    name: 'deleteCarRecommendationPart',
    description: 'Удалить запчасть из рекомендации',
  })
  async deleteCarRecommendationPart(
    @AuthContext() ctx: AuthContextType,
    @Args('id', { type: () => ID }) id: string,
  ) {
    const part = await this.recommendationService.findRecommendationPartById(
      ctx,
      id,
    );
    const carId = part?.recommendation?.carId;

    const result = await this.recommendationService.deleteRecommendationPart(
      ctx,
      id,
    );
    if (carId) {
      await this.publishCarRecommendationsUpdated(ctx, carId);
    }
    return result;
  }

  @ResolveField(() => EmployeeModel, { nullable: true })
  async worker(
    @AuthContext() ctx: AuthContextType,
    @Parent() rec: CarRecommendationModel,
  ): Promise<EmployeeModel | null> {
    if (!rec.workerId) return null;
    return (await this.employeeService.resolveEmployeeByWorkerId(
      ctx,
      rec.workerId,
    )) as any;
  }

  @ResolveField(() => CarModel, { nullable: true })
  async car(
    @AuthContext() ctx: AuthContextType,
    @Parent() rec: CarRecommendationModel,
  ): Promise<CarModel | null> {
    if (!rec.carId) return null;
    return (await this.carService.findById(ctx, rec.carId)) as any;
  }

  @ResolveField(() => AppUserModel, { nullable: true })
  async createdByUser(@Parent() rec: CarRecommendationModel) {
    if (!rec.createdBy) return null;
    return this.appUserLoader.load(rec.createdBy);
  }
}

@Resolver(() => CarRecommendationPartModel)
export class CarRecommendationPartResolver {
  constructor(private readonly appUserLoader: AppUserLoader) {}

  @ResolveField(() => AppUserModel, { nullable: true })
  async createdByUser(@Parent() part: CarRecommendationPartModel) {
    if (!part.createdBy) return null;
    return this.appUserLoader.load(part.createdBy);
  }
}

@Resolver(() => CarRecommendationModel)
export class RecommendationSubscriptionResolver {
  constructor(@Inject('PUB_SUB') private readonly pubSub: PubSub) {}

  @Subscription(() => [CarRecommendationModel], {
    filter: (payload, variables) => {
      const recommendations = payload.carRecommendationsUpdated;
      if (!recommendations || recommendations.length === 0) {
        return variables.carId === payload.carId;
      }
      return recommendations.some((r: any) => r.carId === variables.carId);
    },
  })
  async carRecommendationsUpdated(
    @Args('carId', { type: () => ID }) carId: string,
  ) {
    return this.pubSub.asyncIterableIterator(
      `CAR_RECOMMENDATIONS_UPDATED_${carId}`,
    );
  }
}
