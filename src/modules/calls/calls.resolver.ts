import { Inject } from '@nestjs/common';
import {
  Args,
  ID,
  Int,
  Mutation,
  Query,
  Resolver,
  Subscription,
} from '@nestjs/graphql';
import { PubSub } from 'graphql-subscriptions';
import { AuthContext } from 'src/common/decorators/auth-context.decorator';
import { RequireTenant } from 'src/common/decorators/skip-tenant.decorator';
import { PaginationArgs } from 'src/common/pagination.args';
import type { AuthContext as AuthContextType } from 'src/common/user-id.store';
import { CallsService } from './calls.service';
import { CallRoutingBindingsService } from './call-routing-bindings.service';
import { CallFilterInput } from './inputs/call-filter.input';
import { CallRoutingBindingFilterInput } from './inputs/call-routing-binding-filter.input';
import { CreateCallRoutingBindingInput } from './inputs/create-call-routing-binding.input';
import { MarkCallCallbackInput } from './inputs/mark-call-callback.input';
import { UpdateCallRoutingBindingInput } from './inputs/update-call-routing-binding.input';
import { CallModel } from './models/call.model';
import { CallRoutingBindingModel } from './models/call-routing-binding.model';
import { PaginatedCallRoutingBindings } from './types/paginated-call-routing-bindings.type';
import { PaginatedCalls } from './types/paginated-calls.type';

@Resolver()
@RequireTenant()
export class CallsResolver {
  constructor(
    private readonly callsService: CallsService,
    private readonly callRoutingBindingsService: CallRoutingBindingsService,
  ) {}

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

  @Query(() => PaginatedCallRoutingBindings)
  async callRoutingBindings(
    @AuthContext() ctx: AuthContextType,
    @Args() pagination?: PaginationArgs,
    @Args('filter', {
      type: () => CallRoutingBindingFilterInput,
      nullable: true,
    })
    filter?: CallRoutingBindingFilterInput,
  ): Promise<PaginatedCallRoutingBindings> {
    const { take = 25, skip = 0 } = pagination ?? {};
    return this.callRoutingBindingsService.list(ctx, take, skip, filter);
  }

  @Mutation(() => CallRoutingBindingModel)
  async createCallRoutingBinding(
    @AuthContext() ctx: AuthContextType,
    @Args('input') input: CreateCallRoutingBindingInput,
  ): Promise<CallRoutingBindingModel> {
    return this.callRoutingBindingsService.create(ctx, input);
  }

  @Mutation(() => CallRoutingBindingModel)
  async updateCallRoutingBinding(
    @AuthContext() ctx: AuthContextType,
    @Args('input') input: UpdateCallRoutingBindingInput,
  ): Promise<CallRoutingBindingModel> {
    return this.callRoutingBindingsService.update(ctx, input);
  }

  @Mutation(() => CallRoutingBindingModel)
  async deleteCallRoutingBinding(
    @AuthContext() ctx: AuthContextType,
    @Args('id', { type: () => ID }) id: string,
  ): Promise<CallRoutingBindingModel> {
    return this.callRoutingBindingsService.remove(ctx, id);
  }
}

@Resolver(() => CallModel)
@RequireTenant()
export class CallsSubscriptionResolver {
  constructor(@Inject('CALLS_PUB_SUB') private readonly pubSub: PubSub) {}

  @Subscription(() => CallModel)
  incomingCall(@AuthContext() ctx: AuthContextType) {
    return this.pubSub.asyncIterableIterator(`CALL_INCOMING_${ctx.tenantId}`);
  }

  @Subscription(() => CallModel)
  missedCall(@AuthContext() ctx: AuthContextType) {
    return this.pubSub.asyncIterableIterator(`CALL_MISSED_${ctx.tenantId}`);
  }
}
