import { Resolver, Query, Mutation, Args } from '@nestjs/graphql';
import { AppealService } from './appeal.service';
import { AppealModel } from './models/appeal.model';
import { AppealDetailModel } from './models/appeal-detail.model';
import { UpdateAppealStatusInput } from './inputs/update-appeal-status.input';
import { GetAppealDetailInput } from './inputs/get-appeal-detail.input';
import { PaginationArgs } from 'src/common/pagination.args';
import { PaginatedAppeals } from './types/paginated-appeals.type';
import { AuthContext } from 'src/common/decorators/auth-context.decorator';
import { RequireTenant } from 'src/common/decorators/skip-tenant.decorator';
import type { AuthContext as AuthContextType } from 'src/common/user-id.store';

@Resolver()
@RequireTenant()
export class AppealResolver {
  constructor(private readonly appealService: AppealService) {}

  @Query(() => PaginatedAppeals)
  async appeals(
    @AuthContext() ctx: AuthContextType,
    @Args() pagination?: PaginationArgs,
  ) {
    const { take = 25, skip = 0 } = pagination ?? {};
    return this.appealService.listAppeals(ctx, take, skip);
  }

  @Query(() => AppealDetailModel)
  async appealDetail(
    @AuthContext() ctx: AuthContextType,
    @Args('input') input: GetAppealDetailInput,
  ): Promise<AppealDetailModel> {
    return this.appealService.getAppealDetail(ctx, input.id, input.type);
  }

  @Query(() => Number)
  async appealOpenCount(@AuthContext() ctx: AuthContextType): Promise<number> {
    return this.appealService.appealOpenCount(ctx);
  }

  @Mutation(() => Boolean)
  async updateAppealStatus(
    @AuthContext() ctx: AuthContextType,
    @Args('input') input: UpdateAppealStatusInput,
  ): Promise<boolean> {
    await this.appealService.updateAppealStatus(ctx, input.appealId, input.status);
    return true;
  }
}
