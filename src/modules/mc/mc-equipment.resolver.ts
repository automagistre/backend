import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { McEquipmentModel } from './models/mc-equipment.model';
import { McEquipmentService } from './mc-equipment.service';
import { CreateMcEquipmentInput } from './inputs/create-mc-equipment.input';
import { UpdateMcEquipmentInput } from './inputs/update-mc-equipment.input';
import { PaginationArgs } from 'src/common/pagination.args';
import { PaginatedMcEquipments } from './types/paginated-mc-equipments.type';

@Resolver(() => McEquipmentModel)
export class McEquipmentResolver {
  constructor(private readonly mcEquipmentService: McEquipmentService) {}

  @Query(() => PaginatedMcEquipments, {
    name: 'mcEquipments',
    description: 'Список комплектаций',
  })
  async mcEquipments(
    @Args() pagination?: PaginationArgs,
    @Args('search', { nullable: true }) search?: string,
    @Args('vehicleId', { nullable: true }) vehicleId?: string,
    @Args('period', { nullable: true }) period?: number,
  ) {
    const { take = 25, skip = 0 } = pagination ?? {};
    return this.mcEquipmentService.findMany({
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
  async mcEquipment(@Args('id') id: string) {
    return this.mcEquipmentService.findOne(id);
  }

  @Mutation(() => McEquipmentModel, {
    name: 'createMcEquipment',
    description: 'Создать комплектацию',
  })
  async createMcEquipment(@Args('input') input: CreateMcEquipmentInput) {
    return this.mcEquipmentService.create(input);
  }

  @Mutation(() => McEquipmentModel, {
    name: 'updateMcEquipment',
    description: 'Обновить комплектацию (включая дерево работ/запчастей)',
  })
  async updateMcEquipment(@Args('input') input: UpdateMcEquipmentInput) {
    return this.mcEquipmentService.update(input);
  }

  @Mutation(() => McEquipmentModel, {
    name: 'deleteMcEquipment',
    description: 'Удалить комплектацию',
  })
  async deleteMcEquipment(@Args('id') id: string) {
    return this.mcEquipmentService.remove(id);
  }
}
