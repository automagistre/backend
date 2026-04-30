import { Args, ID, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Public } from 'src/modules/auth/decorators/public.decorator';
import { WwwService } from './www.service';
import {
  WwwTenant,
  WwwTenantContext,
} from './decorators/www-tenant.decorator';
import { WwwStats } from './models/www-stats.model';
import { WwwReviewConnection } from './models/www-review.model';
import { WwwVehicle } from './models/www-vehicle.model';
import { WwwMaintenance } from './models/www-maintenance.model';
import { WwwCreateAppealOutput } from './models/create-appeal-output.model';
import {
  WwwCreateAppealCalculatorInput,
  WwwCreateAppealCallInput,
  WwwCreateAppealCooperationInput,
  WwwCreateAppealQuestionInput,
  WwwCreateAppealScheduleInput,
  WwwCreateAppealTireFittingInput,
} from './inputs/create-appeal.inputs';

@Public()
@Resolver()
export class WwwResolver {
  constructor(private readonly wwwService: WwwService) {}

  // ──────────────────────────────────────────────────────────────────────
  // Queries
  // ──────────────────────────────────────────────────────────────────────

  @Query(() => WwwStats, { name: 'siteStats' })
  async stats(@WwwTenant() ctx: WwwTenantContext): Promise<WwwStats> {
    return this.wwwService.getStats(ctx);
  }

  @Query(() => WwwReviewConnection, { name: 'siteReviews' })
  async reviews(
    @WwwTenant() ctx: WwwTenantContext,
    @Args('first', { type: () => Int, nullable: true, defaultValue: 10 })
    first: number,
    @Args('after', { type: () => String, nullable: true })
    after: string | null,
  ): Promise<WwwReviewConnection> {
    return this.wwwService.getReviews(ctx, first, after);
  }

  @Query(() => WwwVehicle, { name: 'siteVehicle' })
  async vehicle(
    @WwwTenant() ctx: WwwTenantContext,
    @Args('id', { type: () => ID }) id: string,
  ): Promise<WwwVehicle> {
    return this.wwwService.getVehicle(ctx, id);
  }

  @Query(() => [WwwVehicle], { name: 'siteVehicles' })
  async vehicles(
    @WwwTenant() ctx: WwwTenantContext,
    @Args('manufacturerId', { type: () => ID }) manufacturerId: string,
  ): Promise<WwwVehicle[]> {
    return this.wwwService.getVehiclesByManufacturer(ctx, manufacturerId);
  }

  @Query(() => [WwwMaintenance], { name: 'siteMaintenances' })
  async maintenances(
    @WwwTenant() ctx: WwwTenantContext,
    @Args('vehicleId', { type: () => ID }) vehicleId: string,
  ): Promise<WwwMaintenance[]> {
    return this.wwwService.getMaintenancesByVehicle(ctx, vehicleId);
  }

  // ──────────────────────────────────────────────────────────────────────
  // Mutations: создание обращений с www-форм
  // ──────────────────────────────────────────────────────────────────────

  @Mutation(() => WwwCreateAppealOutput, { name: 'siteCreateAppealCalculator' })
  async createAppealCalculator(
    @WwwTenant() ctx: WwwTenantContext,
    @Args('input') input: WwwCreateAppealCalculatorInput,
  ): Promise<WwwCreateAppealOutput> {
    return this.wwwService.createAppealCalculator(ctx, input);
  }

  @Mutation(() => WwwCreateAppealOutput, { name: 'siteCreateAppealSchedule' })
  async createAppealSchedule(
    @WwwTenant() ctx: WwwTenantContext,
    @Args('input') input: WwwCreateAppealScheduleInput,
  ): Promise<WwwCreateAppealOutput> {
    return this.wwwService.createAppealSchedule(ctx, input);
  }

  @Mutation(() => WwwCreateAppealOutput, { name: 'siteCreateAppealCooperation' })
  async createAppealCooperation(
    @WwwTenant() ctx: WwwTenantContext,
    @Args('input') input: WwwCreateAppealCooperationInput,
  ): Promise<WwwCreateAppealOutput> {
    return this.wwwService.createAppealCooperation(ctx, input);
  }

  @Mutation(() => WwwCreateAppealOutput, { name: 'siteCreateAppealQuestion' })
  async createAppealQuestion(
    @WwwTenant() ctx: WwwTenantContext,
    @Args('input') input: WwwCreateAppealQuestionInput,
  ): Promise<WwwCreateAppealOutput> {
    return this.wwwService.createAppealQuestion(ctx, input);
  }

  @Mutation(() => WwwCreateAppealOutput, { name: 'siteCreateAppealTireFitting' })
  async createAppealTireFitting(
    @WwwTenant() ctx: WwwTenantContext,
    @Args('input') input: WwwCreateAppealTireFittingInput,
  ): Promise<WwwCreateAppealOutput> {
    return this.wwwService.createAppealTireFitting(ctx, input);
  }

  @Mutation(() => WwwCreateAppealOutput, { name: 'siteCreateAppealCall' })
  async createAppealCall(
    @WwwTenant() ctx: WwwTenantContext,
    @Args('input') input: WwwCreateAppealCallInput,
  ): Promise<WwwCreateAppealOutput> {
    return this.wwwService.createAppealCall(ctx, input);
  }
}
