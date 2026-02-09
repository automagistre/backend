import { Args, Query, Resolver } from '@nestjs/graphql';
import { CounterpartyUnion } from './supplier.union';
import { SupplierService } from './supplier.service';

@Resolver()
export class SupplierResolver {
  constructor(private readonly supplierService: SupplierService) {}

  @Query(() => [CounterpartyUnion], {
    description:
      'Список поставщиков; опциональный поиск по имени/телефону/email.',
  })
  async suppliers(
    @Args('search', { nullable: true }) search?: string,
    @Args('take', { nullable: true }) take?: number,
  ) {
    return this.supplierService.getSuppliers(search ?? undefined, take);
  }

  @Query(() => [CounterpartyUnion], {
    description:
      'Список подрядчиков (без сотрудников); опциональный поиск.',
  })
  async contractors(
    @Args('search', { nullable: true }) search?: string,
    @Args('take', { nullable: true }) take?: number,
  ) {
    return this.supplierService.getContractors(search ?? undefined, take);
  }
}
