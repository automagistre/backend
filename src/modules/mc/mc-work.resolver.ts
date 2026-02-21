import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { McWorkModel } from './models/mc-work.model';
import { McWorkService } from './mc-work.service';
import { CreateMcWorkInput } from './inputs/create-mc-work.input';
import { UpdateMcWorkInput } from './inputs/update-mc-work.input';
import { PaginationArgs } from 'src/common/pagination.args';
import { PaginatedMcWorks } from './types/paginated-mc-works.type';
import { AuthContext } from 'src/common/decorators/auth-context.decorator';
import { RequireTenant } from 'src/common/decorators/skip-tenant.decorator';
import type { AuthContext as AuthContextType } from 'src/common/user-id.store';

@Resolver(() => McWorkModel)
@RequireTenant()
export class McWorkResolver {
  constructor(private readonly mcWorkService: McWorkService) {}

  @Query(() => PaginatedMcWorks, {
    name: 'mcWorks',
    description: 'Список работ ТО',
  })
  async mcWorks(
    @AuthContext() ctx: AuthContextType,
    @Args() pagination?: PaginationArgs,
    @Args('search', { type: () => String, nullable: true }) search?: string,
  ) {
    const { take = 25, skip = 0 } = pagination ?? {};
    return this.mcWorkService.findMany(ctx, { take, skip, search });
  }

  @Query(() => McWorkModel, {
    name: 'mcWork',
    nullable: true,
    description: 'Работа ТО по ID',
  })
  async mcWork(@AuthContext() ctx: AuthContextType, @Args('id') id: string) {
    return this.mcWorkService.findOne(ctx, id);
  }

  @Mutation(() => McWorkModel, {
    name: 'createMcWork',
    description: 'Создать работу ТО',
  })
  async createMcWork(
    @AuthContext() ctx: AuthContextType,
    @Args('input') input: CreateMcWorkInput,
  ) {
    return this.mcWorkService.create(ctx, input);
  }

  @Mutation(() => McWorkModel, {
    name: 'updateMcWork',
    description: 'Обновить работу ТО',
  })
  async updateMcWork(
    @AuthContext() ctx: AuthContextType,
    @Args('input') input: UpdateMcWorkInput,
  ) {
    return this.mcWorkService.update(ctx, input);
  }

  @Mutation(() => McWorkModel, {
    name: 'deleteMcWork',
    description: 'Удалить работу ТО',
  })
  async deleteMcWork(
    @AuthContext() ctx: AuthContextType,
    @Args('id') id: string,
  ) {
    return this.mcWorkService.remove(ctx, id);
  }
}
