import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { CreateManufacturerInput } from './inputs/create.input';
import { UpdateManufacturerInput } from './inputs/update.input';
import { ManufacturerModel } from './models/manufacturer.model';
import { ManufacturerService } from './manufacturer.service';
import { PaginationArgs } from 'src/common/pagination.args';
import { PaginatedManufacturers } from './inputs/paginatedManufacturers.type';

@Resolver(() => ManufacturerModel)
export class ManufacturerResolver {
  constructor(private ManufacturerService: ManufacturerService) {}

  // Получить всех производителей
  @Query(() => PaginatedManufacturers)
  async manufacturers(
    @Args() pagination?: PaginationArgs,
    @Args('search', { nullable: true }) search?: string,
  ) {
    if (!pagination) {
      pagination = { take: undefined, skip: undefined };
    }
    const { take = 25, skip = 0 } = pagination;

    const itemsPaginated = await this.ManufacturerService.findMany({
      take,
      skip,
      search,
    });
    return itemsPaginated;
  }

  @Query(() => ManufacturerModel, { nullable: true })
  async manufacturer(@Args('id') id: string) {
    return this.ManufacturerService.findOne(id);
  }

  // Создать производителя
  @Mutation(() => ManufacturerModel)
  async createOneManufacturer(@Args('input') input: CreateManufacturerInput) {
    return await this.ManufacturerService.create(input);
  }

  // Обновить производителя
  @Mutation(() => ManufacturerModel)
  async updateOneManufacturer(@Args('input') input: UpdateManufacturerInput) {
    return await this.ManufacturerService.update(input);
  }

  // Удалить производителя
  @Mutation(() => ManufacturerModel)
  async deleteOneManufacturer(@Args('id') id: string) {
    return await this.ManufacturerService.remove(id);
  }
}
