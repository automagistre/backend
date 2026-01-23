import { Args, Query, Resolver } from '@nestjs/graphql';
import { ServiceService } from './service.service';

@Resolver()
export class ServiceResolver {
  constructor(private readonly serviceService: ServiceService) {}

  @Query(() => [String], {
    name: 'services',
    description:
      'Поиск работ по названию (временно из уже созданных работ в заказах)',
  })
  async searchServices(
    @Args('search', { type: () => String, nullable: true }) search?: string,
  ): Promise<string[]> {
    return this.serviceService.searchServices(search);
  }

  @Query(() => [String], {
    name: 'popularServices',
    description: 'Популярные работы (топ-20 по частоте использования)',
  })
  async getPopularServices(): Promise<string[]> {
    return this.serviceService.getPopularServices();
  }
}
