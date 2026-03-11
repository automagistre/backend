import {
  Args,
  ID,
  Int,
  Mutation,
  Parent,
  Query,
  ResolveField,
  Resolver,
} from '@nestjs/graphql';
import { PartService } from './part.service';
import { PartModel } from './models/part.model';
import { CreatePartInput } from './inputs/create.input';
import { UpdatePartInput } from './inputs/update.input';
import { PartPriceService } from './part-price.service';
import { PartPriceModel } from './models/part-price.model';
import { PartDiscountService } from './part-discount.service';
import { PartDiscountModel } from './models/part-discount.model';
import { PartCrossService } from './part-cross.service';
import { AddPartCrossInput } from './inputs/add-part-cross.input';
import { PaginationArgs } from 'src/common/pagination.args';
import { SortDirection } from 'src/common/sorting.args';
import { PaginatedParts } from './inputs/paginatedParts.type';
import { WarehouseService } from '../warehouse/warehouse.service';
import { PartRequiredAvailabilityService } from './part-required-availability.service';
import { applyDefaultCurrency } from 'src/common/money';
import { ReservationService } from '../reservation/reservation.service';
import { SettingsService } from '../settings/settings.service';
import { PartsSmartAutocompleteInput } from './inputs/parts-smart-autocomplete.input';
import { PartSmartAutocompleteItemModel } from './models/part-smart-autocomplete-item.model';
import { AuthContext } from 'src/common/decorators/auth-context.decorator';
import {
  RequireTenant,
  SkipTenant,
} from 'src/common/decorators/skip-tenant.decorator';
import type { AuthContext as AuthContextType } from 'src/common/user-id.store';

@Resolver(() => PartModel)
@SkipTenant()
export class PartResolver {
  constructor(
    private readonly partService: PartService,
    private readonly partPriceService: PartPriceService,
    private readonly partDiscountService: PartDiscountService,
    private readonly partCrossService: PartCrossService,
    private readonly warehouseService: WarehouseService,
    private readonly partRequiredAvailabilityService: PartRequiredAvailabilityService,
    private readonly reservationService: ReservationService,
    private readonly settingsService: SettingsService,
  ) {}

  @Mutation(() => PartModel)
  @RequireTenant()
  async createOnePart(
    @AuthContext() ctx: AuthContextType,
    @Args('input') input: CreatePartInput,
  ): Promise<PartModel> {
    const { price, discount, ...data } = input;

    const part = await this.partService.create(ctx, data as CreatePartInput);
    if (price != null) {
      const defaultCurrency =
        await this.settingsService.getDefaultCurrencyCode();
      const priceData = applyDefaultCurrency(price, defaultCurrency);
      await this.partPriceService.create({
        partId: part.id,
        priceAmount: priceData.amountMinor,
        since: new Date(),
        tenantId: ctx.tenantId,
        createdBy: ctx.userId,
      });
    }
    if (discount != null) {
      const defaultCurrency =
        await this.settingsService.getDefaultCurrencyCode();
      const discountData = applyDefaultCurrency(discount, defaultCurrency);
      await this.partDiscountService.create({
        partId: part.id,
        discountAmount: discountData.amountMinor,
        since: new Date(),
        tenantId: ctx.tenantId,
        createdBy: ctx.userId,
      });
    }
    return part;
  }

  @Mutation(() => PartModel)
  @RequireTenant()
  async updateOnePart(
    @AuthContext() ctx: AuthContextType,
    @Args('input') input: UpdatePartInput,
  ): Promise<PartModel> {
    const currentPrice = await this.partPriceService.findActualPricePart(
      input.id,
      ctx.tenantId,
    );
    const currentDiscount =
      await this.partDiscountService.findActualDiscountPart(
        input.id,
        ctx.tenantId,
      );
    const { price, discount, ...data } = input;

    const part = await this.partService.update(ctx, data);
    const defaultCurrency = await this.settingsService.getDefaultCurrencyCode();

    if (price != null) {
      const priceData = applyDefaultCurrency(price, defaultCurrency);
      if (currentPrice?.priceAmount !== priceData.amountMinor) {
        await this.partPriceService.create({
          partId: part.id,
          priceAmount: priceData.amountMinor,
          since: new Date(),
          tenantId: ctx.tenantId,
          createdBy: ctx.userId,
        });
      }
    }

    if (discount != null) {
      const discountData = applyDefaultCurrency(discount, defaultCurrency);
      if (currentDiscount?.discountAmount !== discountData.amountMinor) {
        await this.partDiscountService.create({
          partId: part.id,
          discountAmount: discountData.amountMinor,
          since: new Date(),
          tenantId: ctx.tenantId,
          createdBy: ctx.userId,
        });
      }
    }

    return part;
  }

  @Mutation(() => PartModel)
  @RequireTenant()
  async deleteOnePart(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<PartModel> {
    return this.partService.delete(id);
  }

  @Query(() => PaginatedParts, {
    name: 'parts',
    description: 'Запчасти с пагинацией',
  })
  async getAllParts(
    @AuthContext() ctx: AuthContextType,
    @Args() pagination?: PaginationArgs,
    @Args('search', { nullable: true }) search?: string,
    @Args('sortBy', { nullable: true }) sortBy?: string,
    @Args('sortDir', { type: () => SortDirection, nullable: true })
    sortDir?: SortDirection,
  ) {
    if (!pagination) {
      pagination = { take: undefined, skip: undefined };
    }
    const { take = 25, skip = 0 } = pagination;

    return await this.partService.findMany({
      take,
      skip,
      search,
      sortBy,
      sortDir,
      tenantId: ctx.tenantId,
    });
  }

  @Query(() => PartModel)
  async part(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<PartModel | null> {
    return this.partService.findOne(id);
  }

  @RequireTenant()
  @Query(() => [PartSmartAutocompleteItemModel], {
    name: 'partsSmartAutocomplete',
    description: 'Умный автокомплит запчастей с учетом кузова и аналогов',
  })
  async partsSmartAutocomplete(
    @AuthContext() ctx: AuthContextType,
    @Args('input') input: PartsSmartAutocompleteInput,
  ): Promise<PartSmartAutocompleteItemModel[]> {
    return this.partService.smartAutocomplete({
      search: input.search,
      take: input.take ?? undefined,
      vehicleId: input.vehicleId ?? null,
      tenantId: ctx.tenantId,
    });
  }

  @ResolveField(() => PartPriceModel)
  @RequireTenant()
  async price(
    @Parent() part: PartModel,
    @AuthContext() ctx: AuthContextType,
  ): Promise<PartPriceModel | null> {
    return this.partPriceService.findActualPricePart(part.id, ctx.tenantId);
  }

  @ResolveField(() => [PartPriceModel])
  @RequireTenant()
  async priceHistory(
    @Parent() part: PartModel,
    @AuthContext() ctx: AuthContextType,
  ): Promise<PartPriceModel[]> {
    return this.partPriceService.findAllByPartId(part.id, ctx.tenantId);
  }

  @ResolveField(() => PartDiscountModel)
  @RequireTenant()
  async discount(
    @Parent() part: PartModel,
    @AuthContext() ctx: AuthContextType,
  ): Promise<PartDiscountModel | null> {
    return this.partDiscountService.findActualDiscountPart(
      part.id,
      ctx.tenantId,
    );
  }

  @ResolveField(() => [PartDiscountModel])
  @RequireTenant()
  async discountHistory(
    @Parent() part: PartModel,
    @AuthContext() ctx: AuthContextType,
  ): Promise<PartDiscountModel[]> {
    return this.partDiscountService.findAllByPartId(part.id, ctx.tenantId);
  }

  @ResolveField(() => [PartModel])
  async crossParts(@Parent() part: PartModel): Promise<PartModel[]> {
    return this.partCrossService.getCrossParts(part.id);
  }

  @RequireTenant()
  @ResolveField(() => Int, { nullable: true })
  async stockQuantity(
    @Parent() part: PartModel,
    @AuthContext() ctx: AuthContextType,
  ): Promise<number | null> {
    return this.warehouseService.getStockQuantity(ctx, part.id);
  }

  @RequireTenant()
  @ResolveField(() => Int, { nullable: true })
  async reservedInActiveOrders(
    @Parent() part: PartModel,
    @AuthContext() ctx: AuthContextType,
  ): Promise<number | null> {
    const map =
      await this.reservationService.getTotalReservedInActiveOrdersByPartIds(
        [part.id],
        ctx.tenantId,
      );
    return map.get(part.id) ?? 0;
  }

  @RequireTenant()
  @ResolveField(() => Int, { nullable: true })
  async orderFromQuantity(
    @Parent() part: PartModel,
    @AuthContext() ctx: AuthContextType,
  ): Promise<number | null> {
    const availability = await this.partRequiredAvailabilityService.findForPart(
      ctx,
      part.id,
    );
    return availability?.orderFromQuantity ?? null;
  }

  @RequireTenant()
  @ResolveField(() => Int, { nullable: true })
  async orderUpToQuantity(
    @Parent() part: PartModel,
    @AuthContext() ctx: AuthContextType,
  ): Promise<number | null> {
    const availability = await this.partRequiredAvailabilityService.findForPart(
      ctx,
      part.id,
    );
    return availability?.orderUpToQuantity ?? null;
  }

  @Mutation(() => PartModel)
  async addPartCross(
    @Args('input') input: AddPartCrossInput,
  ): Promise<PartModel> {
    await this.partCrossService.addCross(input.partId, input.crossPartId);
    const part = await this.partService.findOne(input.partId);
    if (!part) {
      throw new Error('Запчасть не найдена');
    }
    return part;
  }

  @Mutation(() => PartModel)
  async removePartCross(
    @Args('partId', { type: () => ID }) partId: string,
  ): Promise<PartModel> {
    await this.partCrossService.removeCross(partId);
    const part = await this.partService.findOne(partId);
    if (!part) {
      throw new Error('Запчасть не найдена');
    }
    return part;
  }
}
