import { Args, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import { AuthContext } from 'src/common/decorators/auth-context.decorator';
import { RequireTenant } from 'src/common/decorators/skip-tenant.decorator';
import { PaginationArgs } from 'src/common/pagination.args';
import type { AuthContext as AuthContextType } from 'src/common/user-id.store';
import { CallsService } from './calls.service';
import { CallFilterInput } from './inputs/call-filter.input';
import { MarkCallCallbackInput } from './inputs/mark-call-callback.input';
import { CallModel } from './models/call.model';
import { PaginatedCalls } from './types/paginated-calls.type';

@Resolver()
@RequireTenant()
export class CallsResolver {
  constructor(private readonly callsService: CallsService) {}

  @Query(() => PaginatedCalls)
  async calls(
    @AuthContext() ctx: AuthContextType,
    @Args() pagination?: PaginationArgs,
    @Args('filter', { type: () => CallFilterInput, nullable: true })
    filter?: CallFilterInput,
  ): Promise<PaginatedCalls> {
    const { take = 25, skip = 0 } = pagination ?? {};
    return this.callsService.listCalls(ctx, take, skip, filter);
  }

  @Query(() => Int)
  async missedCallsCount(@AuthContext() ctx: AuthContextType): Promise<number> {
    return this.callsService.missedCallsCount(ctx);
  }

  @Mutation(() => CallModel)
  async markCallCallback(
    @AuthContext() ctx: AuthContextType,
    @Args('input') input: MarkCallCallbackInput,
  ): Promise<CallModel> {
    return this.callsService.markCallCallback(ctx, input);
  }
}
