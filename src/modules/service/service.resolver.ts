import { Args, ID, Int, Query, Resolver } from '@nestjs/graphql';
import { ServiceService } from './service.service';
import { PaginatedCarServices } from './types/paginated-car-services.type';
import { ServiceSuggestionModel } from './models/service-suggestion.model';
import { AuthContext } from 'src/common/decorators/auth-context.decorator';
import { RequireTenant } from 'src/common/decorators/skip-tenant.decorator';
import type { AuthContext as AuthContextType } from 'src/common/user-id.store';

@Resolver()
@RequireTenant()
export class ServiceResolver {
  constructor(private readonly serviceService: ServiceService) {}

  @Query(() => PaginatedCarServices, {
    name: 'carServicesHistory',
    description: 'История выполненных работ по автомобилю',
  })
  async carServicesHistory(
    @AuthContext() ctx: AuthContextType,
    @Args('carId', { type: () => ID }) carId: string,
    @Args('search', { type: () => String, nullable: true }) search?: string,
    @Args('take', { type: () => Int, nullable: true }) take?: number,
    @Args('skip', { type: () => Int, nullable: true }) skip?: number,
  ) {
    return this.serviceService.getCarServicesHistory(
      ctx,
      carId,
      search,
      take ?? 50,
      skip ?? 0,
    );
  }

  @Query(() => [ServiceSuggestionModel], {
    name: 'services',
    description:
      'Поиск работ по названию (временно из уже созданных работ в заказах)',
  })
  async searchServices(
    @AuthContext() ctx: AuthContextType,
    @Args('search', { type: () => String, nullable: true }) search?: string,
  ): Promise<ServiceSuggestionModel[]> {
    return this.serviceService.searchServices(ctx, search);
  }

  @Query(() => [ServiceSuggestionModel], {
    name: 'popularServices',
    description: 'Популярные работы (топ-20 по частоте в закрытых заказах)',
  })
  async getPopularServices(
    @AuthContext() ctx: AuthContextType,
  ): Promise<ServiceSuggestionModel[]> {
    return this.serviceService.getPopularServices(ctx);
  }
}
