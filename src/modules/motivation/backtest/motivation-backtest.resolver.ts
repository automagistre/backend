import { Args, ID, Query, Resolver } from '@nestjs/graphql';
import { AuthContext } from 'src/common/decorators/auth-context.decorator';
import { RequireTenant } from 'src/common/decorators/skip-tenant.decorator';
import type { AuthContext as AuthContextType } from 'src/common/user-id.store';
import {
  MotivationBacktestModel,
  MotivationOrderBreakdownModel,
} from '../models/motivation-backtest.model';
import { MotivationSchemeModel } from '../models/motivation-scheme.model';
import {
  fromMotivationSchemeInput,
  toMotivationSchemeModel,
} from '../models/motivation-scheme.mapper';
import { MotivationBacktestService } from './motivation-backtest.service';

@Resolver()
@RequireTenant()
export class MotivationBacktestResolver {
  constructor(private readonly backtests: MotivationBacktestService) {}

  @Query(() => MotivationSchemeModel, {
    description: 'Стартовая схема премии под должности тенанта',
  })
  async motivationDefaultScheme(
    @AuthContext() ctx: AuthContextType,
  ): Promise<MotivationSchemeModel> {
    return toMotivationSchemeModel(
      await this.backtests.defaultScheme(ctx.tenantId),
    );
  }

  @Query(() => MotivationBacktestModel, {
    description: 'Премия за период по схеме, без записи в БД',
  })
  async motivationBacktest(
    @AuthContext() ctx: AuthContextType,
    @Args('dateFrom') dateFrom: Date,
    @Args('dateTo') dateTo: Date,
    @Args('scheme', { type: () => MotivationSchemeModel, nullable: true })
    scheme?: MotivationSchemeModel | null,
  ): Promise<MotivationBacktestModel> {
    return this.backtests.backtest(
      ctx.tenantId,
      dateFrom,
      dateTo,
      scheme
        ? fromMotivationSchemeInput(scheme)
        : await this.backtests.defaultScheme(ctx.tenantId),
    );
  }

  @Query(() => MotivationOrderBreakdownModel, {
    description: 'Расшифровка премии закрытого заказа по схеме',
  })
  async motivationOrderBreakdown(
    @AuthContext() ctx: AuthContextType,
    @Args('orderId', { type: () => ID }) orderId: string,
    @Args('scheme', { type: () => MotivationSchemeModel, nullable: true })
    scheme?: MotivationSchemeModel | null,
  ): Promise<MotivationOrderBreakdownModel> {
    return this.backtests.orderBreakdown(
      ctx.tenantId,
      orderId,
      scheme
        ? fromMotivationSchemeInput(scheme)
        : await this.backtests.defaultScheme(ctx.tenantId),
    );
  }
}
