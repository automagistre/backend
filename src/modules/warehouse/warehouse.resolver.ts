import { Args, ID, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import { PartSupplyService } from './part-supply.service';
import { ProcurementService } from './procurement.service';
import { ProcurementRowModel } from './models/procurement-row.model';
import { ProcurementTableResult } from './models/procurement-table-result.type';
import { SupplyBySupplierModel } from './models/supply-by-supplier.model';
import { PartInOrderModel } from './models/part-in-order.model';
import { CreatePartSupplyInput } from './inputs/create-part-supply.input';
import { CancelPartSupplyInput } from './inputs/cancel-part-supply.input';

@Resolver()
export class WarehouseResolver {
  constructor(
    private readonly procurementService: ProcurementService,
    private readonly partSupplyService: PartSupplyService,
  ) {}

  @Query(() => ProcurementTableResult, {
    name: 'procurementTable',
    description: 'Таблица Закупки: наличие, в заказах, в резерве, в поставке, нужно заказать',
  })
  async procurementTable(
    @Args('skip', { type: () => Int, defaultValue: 0 }) skip: number,
    @Args('take', { type: () => Int, defaultValue: 25 }) take: number,
    @Args('search', { type: () => String, nullable: true }) search?: string,
  ): Promise<{ items: ProcurementRowModel[]; total: number }> {
    return this.procurementService.getProcurementTable({ skip, take, search });
  }

  @Query(() => [PartInOrderModel], {
    name: 'ordersWithPart',
    description: 'Заказы, в которых содержится запчасть (активные), с кол-вом и резервом',
  })
  async ordersWithPart(
    @Args('partId', { type: () => ID }) partId: string,
  ): Promise<PartInOrderModel[]> {
    return this.procurementService.getOrdersWithPart(partId);
  }

  @Query(() => [SupplyBySupplierModel], {
    name: 'suppliesByPart',
    description: 'Список ожидаемых поставок по запчасти (по поставщикам)',
  })
  async suppliesByPart(
    @Args('partId', { type: () => ID }) partId: string,
  ): Promise<SupplyBySupplierModel[]> {
    const rows = await this.partSupplyService.getSuppliesByPart(partId);
    return rows;
  }

  @Mutation(() => SupplyBySupplierModel, {
    name: 'createPartSupply',
    description: 'Создать ручную поставку',
  })
  async createPartSupply(
    @Args('input') input: CreatePartSupplyInput,
  ): Promise<{ supplierId: string; quantity: number; updatedAt: Date }> {
    const supply = await this.partSupplyService.createPartSupply(
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
    @Args('input') input: CancelPartSupplyInput,
  ): Promise<boolean> {
    await this.partSupplyService.cancelPartSupply(
      input.partId,
      input.supplierId,
      input.quantity,
    );
    return true;
  }
}
