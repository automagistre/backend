import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { McWorkModel } from './models/mc-work.model';
import { McWorkService } from './mc-work.service';
import { CreateMcWorkInput } from './inputs/create-mc-work.input';
import { UpdateMcWorkInput } from './inputs/update-mc-work.input';
import { PaginationArgs } from 'src/common/pagination.args';
import { PaginatedMcWorks } from './types/paginated-mc-works.type';

@Resolver(() => McWorkModel)
export class McWorkResolver {
  constructor(private readonly mcWorkService: McWorkService) {}

  @Query(() => PaginatedMcWorks, {
    name: 'mcWorks',
    description: 'Список работ ТО',
  })
  async mcWorks(
    @Args() pagination?: PaginationArgs,
    @Args('search', { nullable: true }) search?: string,
  ) {
    const { take = 25, skip = 0 } = pagination ?? {};
    return this.mcWorkService.findMany({ take, skip, search });
  }

  @Query(() => McWorkModel, {
    name: 'mcWork',
    nullable: true,
    description: 'Работа ТО по ID',
  })
  async mcWork(@Args('id') id: string) {
    return this.mcWorkService.findOne(id);
  }

  @Mutation(() => McWorkModel, {
    name: 'createMcWork',
    description: 'Создать работу ТО',
  })
  async createMcWork(@Args('input') input: CreateMcWorkInput) {
    return this.mcWorkService.create(input);
  }

  @Mutation(() => McWorkModel, {
    name: 'updateMcWork',
    description: 'Обновить работу ТО',
  })
  async updateMcWork(@Args('input') input: UpdateMcWorkInput) {
    return this.mcWorkService.update(input);
  }

  @Mutation(() => McWorkModel, {
    name: 'deleteMcWork',
    description: 'Удалить работу ТО',
  })
  async deleteMcWork(@Args('id') id: string) {
    return this.mcWorkService.remove(id);
  }
}
