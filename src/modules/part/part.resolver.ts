import {
  Args,
  ID,
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
import { PaginationArgs } from 'src/common/pagination.args';
import { PaginatedParts } from './inputs/paginatedParts.type';

@Resolver(() => PartModel)
export class PartResolver {
  constructor(
    private readonly partService: PartService,
    private readonly partPriceService: PartPriceService,
    private readonly partDiscountService: PartDiscountService,
  ) {}

  @Mutation(() => PartModel)
  async createOnePart(
    @Args('input') input: CreatePartInput,
  ): Promise<PartModel> {
    if (input?.price) {
      const { price, ...data } = input;
      const part = await this.partService.create(data);
      await this.partPriceService.create({
        partId: part.id,
        priceAmount: input.price,
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
    const currentPrice = await this.partPriceService.findActualPricePart(input.id);
    const currentDiscount = await this.partDiscountService.findActualDiscountPart(input.id);
    const { price, discount, ...data } = input;
    
    const part = await this.partService.update(data);
    
    if (price && currentPrice?.priceAmount !== input.price) {
      await this.partPriceService.create({
        partId: part.id,
        priceAmount: price,
        since: new Date(),
      });
    }
    
    if (discount !== undefined && currentDiscount?.discountAmount !== discount) {
      await this.partDiscountService.create({
        partId: part.id,
        discountAmount: discount,
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

  @Query(() => PaginatedParts, { name: 'parts', description: 'Запчасти с пагинацией' })
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
  async discountHistory(@Parent() part: PartModel): Promise<PartDiscountModel[]> {
    return this.partDiscountService.findAllByPartId(part.id);
  }
}
