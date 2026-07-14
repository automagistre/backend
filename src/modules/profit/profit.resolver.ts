import { Args, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import { AuthContext } from 'src/common/decorators/auth-context.decorator';
import { RequireTenant } from 'src/common/decorators/skip-tenant.decorator';
import type { AuthContext as AuthContextType } from 'src/common/user-id.store';
import { PaginationArgs } from 'src/common/pagination.args';
import { BackfillOrderProfitsInput } from './inputs/backfill-order-profits.input';
import { PaginatedPeriodOrderProfits } from './models/paginated-period-order-profits.model';
import { PeriodProfitModel } from './models/period-profit.model';
import { ProfitService } from './profit.service';

@Resolver()
@RequireTenant()
export class ProfitResolver {
  constructor(private readonly profitService: ProfitService) {}

  @Query(() => PeriodProfitModel, {
    name: 'periodProfit',
    description: 'Сводка валовой прибыли за период',
  })
  async periodProfit(
    @AuthContext() ctx: AuthContextType,
    @Args('dateFrom') dateFrom: Date,
    @Args('dateTo') dateTo: Date,
  ): Promise<PeriodProfitModel> {
    return this.profitService.getPeriodProfit(ctx, dateFrom, dateTo);
  }

  @Query(() => PaginatedPeriodOrderProfits, {
    name: 'periodOrderProfits',
    description: 'Заказы с прибылью за период (постранично)',
  })
  async periodOrderProfits(
    @AuthContext() ctx: AuthContextType,
    @Args('dateFrom') dateFrom: Date,
    @Args('dateTo') dateTo: Date,
    @Args() pagination?: PaginationArgs,
  ): Promise<PaginatedPeriodOrderProfits> {
    const { take = 25, skip = 0 } = pagination ?? {};
    return this.profitService.getPeriodOrderProfits(
      ctx,
      dateFrom,
      dateTo,
      take,
      skip,
    );
  }

  @Query(() => Date, {
    nullable: true,
    name: 'profitBackfillBoundary',
    description: 'Граница бэкофилла (MIN income_accrue.created_at)',
  })
  async profitBackfillBoundary(
    @AuthContext() ctx: AuthContextType,
  ): Promise<Date | null> {
    return this.profitService.getBackfillBoundary(ctx.tenantId);
  }

  @Mutation(() => Int, {
    name: 'backfillOrderProfits',
    description:
      'Бэкофилл снапшотов прибыли (LEGACY_BACKFILL), пропускает заказы с LIVE',
  })
  async backfillOrderProfits(
    @AuthContext() ctx: AuthContextType,
    @Args('input', { nullable: true }) input?: BackfillOrderProfitsInput,
  ): Promise<number> {
    return this.profitService.backfillOrderProfits(ctx, input);
  }
}
