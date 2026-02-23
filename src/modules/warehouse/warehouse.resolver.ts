import { Args, ID, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import { PartSupplyService } from './part-supply.service';
import { ProcurementService } from './procurement.service';
import { PartMotionService } from './part-motion.service';
import { ProcurementRowModel } from './models/procurement-row.model';
import { ProcurementTableResult } from './models/procurement-table-result.type';
import { SupplyBySupplierModel } from './models/supply-by-supplier.model';
import { PartInOrderModel } from './models/part-in-order.model';
import { PaginatedMotions } from './types/paginated-motions.type';
import { CreatePartSupplyInput } from './inputs/create-part-supply.input';
import { CancelPartSupplyInput } from './inputs/cancel-part-supply.input';
import { MotionFilterInput } from './inputs/motion-filter.input';
import { AuthContext } from 'src/common/decorators/auth-context.decorator';
import { RequireTenant } from 'src/common/decorators/skip-tenant.decorator';
import type { AuthContext as AuthContextType } from 'src/common/user-id.store';

@Resolver()
@RequireTenant()
export class WarehouseResolver {
  constructor(
    private readonly procurementService: ProcurementService,
    private readonly partSupplyService: PartSupplyService,
    private readonly partMotionService: PartMotionService,
  ) {}

  @Query(() => ProcurementTableResult, {
    name: 'procurementTable',
    description: 'Таблица Закупки: наличие, в заказах, в резерве, в поставке, нужно заказать',
  })
  async procurementTable(
    @AuthContext() ctx: AuthContextType,
    @Args('skip', { type: () => Int, defaultValue: 0 }) skip: number,
    @Args('take', { type: () => Int, defaultValue: 25 }) take: number,
    @Args('search', { type: () => String, nullable: true }) search?: string,
  ): Promise<{ items: ProcurementRowModel[]; total: number }> {
    return this.procurementService.getProcurementTable(ctx, { skip, take, search });
  }

  @Query(() => [PartInOrderModel], {
    name: 'ordersWithPart',
    description: 'Заказы, в которых содержится запчасть (активные), с кол-вом и резервом',
  })
  async ordersWithPart(
    @AuthContext() ctx: AuthContextType,
    @Args('partId', { type: () => ID }) partId: string,
  ): Promise<PartInOrderModel[]> {
    return this.procurementService.getOrdersWithPart(ctx, partId);
  }

  @Query(() => [SupplyBySupplierModel], {
    name: 'suppliesByPart',
    description: 'Список ожидаемых поставок по запчасти (по поставщикам)',
  })
  async suppliesByPart(
    @AuthContext() ctx: AuthContextType,
    @Args('partId', { type: () => ID }) partId: string,
  ): Promise<SupplyBySupplierModel[]> {
    return this.partSupplyService.getSuppliesByPart(ctx, partId);
  }

  @Mutation(() => SupplyBySupplierModel, {
    name: 'createPartSupply',
    description: 'Создать ручную поставку',
  })
  async createPartSupply(
    @AuthContext() ctx: AuthContextType,
    @Args('input') input: CreatePartSupplyInput,
  ): Promise<{ supplierId: string; quantity: number; updatedAt: Date }> {
    const supply = await this.partSupplyService.createPartSupply(
      ctx,
      input.partId,
      input.supplierId,
      input.quantity,
    );
    return {
      supplierId: supply.supplierId,
      quantity: supply.quantity,
      updatedAt: new Date(),
    };
  }

  @Mutation(() => Boolean, {
    name: 'cancelPartSupply',
    description: 'Отменить поставку (удалить из ожидаемых)',
  })
  async cancelPartSupply(
    @AuthContext() ctx: AuthContextType,
    @Args('input') input: CancelPartSupplyInput,
  ): Promise<boolean> {
    await this.partSupplyService.cancelPartSupply(
      ctx,
      input.partId,
      input.supplierId,
      input.quantity,
    );
    return true;
  }

  @Query(() => PaginatedMotions, {
    name: 'motions',
    description: 'Движения запчастей с фильтрацией и пагинацией',
  })
  async motions(
    @AuthContext() ctx: AuthContextType,
    @Args('filter', { type: () => MotionFilterInput, nullable: true }) filter?: MotionFilterInput,
    @Args('skip', { type: () => Int, nullable: true }) skip?: number,
    @Args('take', { type: () => Int, nullable: true }) take?: number,
  ): Promise<PaginatedMotions> {
    return this.partMotionService.findMany(ctx, filter, skip ?? 0, take ?? 50);
  }
}
