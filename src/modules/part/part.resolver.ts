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
import { PaginatedParts } from './inputs/paginatedParts.type';
import { PartMotionService } from './part-motion.service';
import { PartRequiredAvailabilityService } from './part-required-availability.service';
import { normalizeMoneyAmount } from 'src/common/utils/money.util';

@Resolver(() => PartModel)
export class PartResolver {
  constructor(
    private readonly partService: PartService,
    private readonly partPriceService: PartPriceService,
    private readonly partDiscountService: PartDiscountService,
    private readonly partCrossService: PartCrossService,
    private readonly partMotionService: PartMotionService,
    private readonly partRequiredAvailabilityService: PartRequiredAvailabilityService,
  ) {}

  @Mutation(() => PartModel)
  async createOnePart(
    @Args('input') input: CreatePartInput,
  ): Promise<PartModel> {
    if (input.price !== undefined) {
      const { price, ...data } = input;
      const part = await this.partService.create(data);
      await this.partPriceService.create({
        partId: part.id,
        priceAmount: normalizeMoneyAmount(price),
        since: new Date(),
      });
      return part;
    }
    return this.partService.create(input);
  }

  @Mutation(() => PartModel)
  async updateOnePart(
    @Args('input') input: UpdatePartInput,
  ): Promise<PartModel> {
    const currentPrice = await this.partPriceService.findActualPricePart(
      input.id,
    );
    const currentDiscount =
      await this.partDiscountService.findActualDiscountPart(input.id);
    const { price, discount, ...data } = input;

    const part = await this.partService.update(data);

    if (price !== undefined) {
      const normalizedPrice = normalizeMoneyAmount(price);
      if (currentPrice?.priceAmount !== normalizedPrice) {
      await this.partPriceService.create({
        partId: part.id,
          priceAmount: normalizedPrice,
        since: new Date(),
      });
      }
    }

    if (
      discount !== undefined &&
      currentDiscount?.discountAmount !== normalizeMoneyAmount(discount)
    ) {
      await this.partDiscountService.create({
        partId: part.id,
        discountAmount: normalizeMoneyAmount(discount),
        since: new Date(),
      });
    }

    return part;
  }

  @Mutation(() => PartModel)
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
    @Args() pagination?: PaginationArgs,
    @Args('search', { nullable: true }) search?: string,
  ) {
    if (!pagination) {
      pagination = { take: undefined, skip: undefined };
    }
    const { take = 25, skip = 0 } = pagination;

    return await this.partService.findMany({ take, skip, search });
  }

  @Query(() => PartModel)
  async part(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<PartModel | null> {
    return this.partService.findOne(id);
  }

  @ResolveField(() => PartPriceModel)
  async price(@Parent() part: PartModel): Promise<PartPriceModel | null> {
    return this.partPriceService.findActualPricePart(part.id);
  }

  @ResolveField(() => [PartPriceModel])
  async priceHistory(@Parent() part: PartModel): Promise<PartPriceModel[]> {
    return this.partPriceService.findAllByPartId(part.id);
  }

  @ResolveField(() => PartDiscountModel)
  async discount(@Parent() part: PartModel): Promise<PartDiscountModel | null> {
    return this.partDiscountService.findActualDiscountPart(part.id);
  }

  @ResolveField(() => [PartDiscountModel])
  async discountHistory(
    @Parent() part: PartModel,
  ): Promise<PartDiscountModel[]> {
    return this.partDiscountService.findAllByPartId(part.id);
  }

  @ResolveField(() => [PartModel])
  async crossParts(@Parent() part: PartModel): Promise<PartModel[]> {
    return this.partCrossService.getCrossParts(part.id);
  }

  @ResolveField(() => Int, { nullable: true })
  async stockQuantity(@Parent() part: PartModel): Promise<number | null> {
    return this.partMotionService.getStockQuantity(part.id);
  }

  @ResolveField(() => Int, { nullable: true })
  async orderFromQuantity(@Parent() part: PartModel): Promise<number | null> {
    const availability = await this.partRequiredAvailabilityService.findForPart(
      part.id,
    );
    return availability?.orderFromQuantity ?? null;
  }

  @ResolveField(() => Int, { nullable: true })
  async orderUpToQuantity(@Parent() part: PartModel): Promise<number | null> {
    const availability = await this.partRequiredAvailabilityService.findForPart(
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
