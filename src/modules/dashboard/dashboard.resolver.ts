import { Args, Query, Resolver } from '@nestjs/graphql';
import { DashboardService } from './dashboard.service';
import { DashboardSummaryModel } from './models/dashboard.models';
import { AuthContext } from 'src/common/decorators/auth-context.decorator';
import { RequireTenant } from 'src/common/decorators/skip-tenant.decorator';
import type { AuthContext as AuthContextType } from 'src/common/user-id.store';

@Resolver()
@RequireTenant()
export class DashboardResolver {
  constructor(private readonly dashboardService: DashboardService) {}

  @Query(() => DashboardSummaryModel, {
    description:
      'Сводные данные для главной страницы (Dashboard). Один запрос на всю страницу.',
  })
  async dashboardSummary(
    @AuthContext() ctx: AuthContextType,
    @Args('tz', { type: () => String, nullable: true }) tz?: string | null,
  ): Promise<DashboardSummaryModel> {
    return this.dashboardService.getSummary(ctx, tz);
  }
}
