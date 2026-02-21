import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { McEquipmentModel } from './models/mc-equipment.model';
import { McEquipmentService } from './mc-equipment.service';
import { CreateMcEquipmentInput } from './inputs/create-mc-equipment.input';
import { UpdateMcEquipmentInput } from './inputs/update-mc-equipment.input';
import { PaginationArgs } from 'src/common/pagination.args';
import { PaginatedMcEquipments } from './types/paginated-mc-equipments.type';
import { AuthContext } from 'src/common/decorators/auth-context.decorator';
import { RequireTenant } from 'src/common/decorators/skip-tenant.decorator';
import type { AuthContext as AuthContextType } from 'src/common/user-id.store';

@Resolver(() => McEquipmentModel)
@RequireTenant()
export class McEquipmentResolver {
  constructor(private readonly mcEquipmentService: McEquipmentService) {}

  @Query(() => PaginatedMcEquipments, {
    name: 'mcEquipments',
    description: 'Список комплектаций',
  })
  async mcEquipments(
    @AuthContext() ctx: AuthContextType,
    @Args() pagination?: PaginationArgs,
    @Args('search', { type: () => String, nullable: true }) search?: string,
    @Args('vehicleId', { type: () => String, nullable: true }) vehicleId?: string,
    @Args('period', { type: () => Number, nullable: true }) period?: number,
  ) {
    const { take = 25, skip = 0 } = pagination ?? {};
    return this.mcEquipmentService.findMany(ctx, {
      take,
      skip,
      search,
      vehicleId,
      period,
    });
  }

  @Query(() => McEquipmentModel, {
    name: 'mcEquipment',
    nullable: true,
    description: 'Комплектация по ID',
  })
  async mcEquipment(
    @AuthContext() ctx: AuthContextType,
    @Args('id') id: string,
  ) {
    return this.mcEquipmentService.findOne(ctx, id);
  }

  @Mutation(() => McEquipmentModel, {
    name: 'createMcEquipment',
    description: 'Создать комплектацию',
  })
  async createMcEquipment(
    @AuthContext() ctx: AuthContextType,
    @Args('input') input: CreateMcEquipmentInput,
  ) {
    return this.mcEquipmentService.create(ctx, input);
  }

  @Mutation(() => McEquipmentModel, {
    name: 'updateMcEquipment',
    description: 'Обновить комплектацию (включая дерево работ/запчастей)',
  })
  async updateMcEquipment(
    @AuthContext() ctx: AuthContextType,
    @Args('input') input: UpdateMcEquipmentInput,
  ) {
    return this.mcEquipmentService.update(ctx, input);
  }

  @Mutation(() => McEquipmentModel, {
    name: 'deleteMcEquipment',
    description: 'Удалить комплектацию',
  })
  async deleteMcEquipment(
    @AuthContext() ctx: AuthContextType,
    @Args('id') id: string,
  ) {
    return this.mcEquipmentService.remove(ctx, id);
  }
}
