import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { StaffPositionModel } from './models/staff-position.model';
import { StaffPositionSettingGroupModel } from './models/staff-position-setting.model';
import { PaginatedStaffPositions } from './types/paginated-staff-positions.type';
import { StaffPositionService } from './staff-position.service';
import {
  CreateStaffPositionInput,
  UpdateStaffPositionInput,
} from './inputs/staff-position.input';
import {
  getStaffPositionSettingsOfGroup,
  STAFF_POSITION_SETTING_GROUPS,
} from './staff-position-settings.catalog';
import { PaginationArgs } from 'src/common/pagination.args';
import { AuthContext } from 'src/common/decorators/auth-context.decorator';
import { RequireTenant } from 'src/common/decorators/skip-tenant.decorator';
import type { AuthContext as AuthContextType } from 'src/common/user-id.store';

@Resolver(() => StaffPositionModel)
@RequireTenant()
export class StaffPositionResolver {
  constructor(private readonly staffPositionService: StaffPositionService) {}

  @Query(() => PaginatedStaffPositions, {
    name: 'staffPositions',
    description: 'Справочник должностей',
  })
  async staffPositions(
    @AuthContext() ctx: AuthContextType,
    @Args() pagination?: PaginationArgs,
    @Args('search', { type: () => String, nullable: true }) search?: string,
    @Args('includeArchived', { nullable: true, defaultValue: false })
    includeArchived?: boolean,
  ) {
    const { take = 25, skip = 0 } = pagination ?? {};
    return this.staffPositionService.findMany(ctx, {
      take,
      skip,
      search,
      includeArchived,
    });
  }

  @Query(() => StaffPositionModel, {
    name: 'staffPosition',
    nullable: true,
    description: 'Должность по ID',
  })
  async staffPosition(
    @AuthContext() ctx: AuthContextType,
    @Args('id') id: string,
  ) {
    return this.staffPositionService.findOne(ctx, id);
  }

  /**
   * Каталог задаёт код: интерфейс рисует группы и контролы отсюда, а не из своего
   * списка, поэтому новая настройка появляется в панели без правок клиента.
   */
  @Query(() => [StaffPositionSettingGroupModel], {
    name: 'staffPositionSettingGroups',
    description: 'Каталог настроек должности, сгруппированный для интерфейса',
  })
  staffPositionSettingGroups(): StaffPositionSettingGroupModel[] {
    return STAFF_POSITION_SETTING_GROUPS.map((group) => ({
      ...group,
      settings: getStaffPositionSettingsOfGroup(group.key)
        .slice()
        .sort((left, right) => Number(right.isMaster) - Number(left.isMaster))
        .map(({ key, type, label, hint, isMaster, options }) => ({
          key,
          type,
          label,
          hint,
          isMaster,
          options: options ? [...options] : undefined,
        })),
    }));
  }

  @Mutation(() => StaffPositionModel, {
    name: 'createStaffPosition',
    description: 'Создать должность',
  })
  async createStaffPosition(
    @AuthContext() ctx: AuthContextType,
    @Args('input') input: CreateStaffPositionInput,
  ) {
    return this.staffPositionService.create(ctx, input);
  }

  @Mutation(() => StaffPositionModel, {
    name: 'updateStaffPosition',
    description: 'Обновить должность',
  })
  async updateStaffPosition(
    @AuthContext() ctx: AuthContextType,
    @Args('input') input: UpdateStaffPositionInput,
  ) {
    return this.staffPositionService.update(ctx, input);
  }

  @Mutation(() => StaffPositionModel, {
    name: 'deleteStaffPosition',
    description:
      'Удалить должность. Если её уже носили — архивировать вместо удаления',
  })
  async deleteStaffPosition(
    @AuthContext() ctx: AuthContextType,
    @Args('id') id: string,
  ) {
    return this.staffPositionService.remove(ctx, id);
  }

  @Mutation(() => StaffPositionModel, {
    name: 'unarchiveStaffPosition',
    description: 'Вернуть должность из архива',
  })
  async unarchiveStaffPosition(
    @AuthContext() ctx: AuthContextType,
    @Args('id') id: string,
  ) {
    return this.staffPositionService.unarchive(ctx, id);
  }
}
