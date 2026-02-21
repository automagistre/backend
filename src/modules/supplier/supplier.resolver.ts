import { Args, Query, Resolver } from '@nestjs/graphql';
import { CounterpartyUnion } from './supplier.union';
import { SupplierService } from './supplier.service';
import { AuthContext } from 'src/common/decorators/auth-context.decorator';
import { RequireTenant } from 'src/common/decorators/skip-tenant.decorator';
import type { AuthContext as AuthContextType } from 'src/common/user-id.store';

@Resolver()
@RequireTenant()
export class SupplierResolver {
  constructor(private readonly supplierService: SupplierService) {}

  @Query(() => [CounterpartyUnion], {
    description:
      'Список поставщиков; опциональный поиск по имени/телефону/email.',
  })
  async suppliers(
    @AuthContext() ctx: AuthContextType,
    @Args('search', { type: () => String, nullable: true }) search?: string,
    @Args('take', { type: () => Number, nullable: true }) take?: number,
  ) {
    return this.supplierService.getSuppliers(ctx, search ?? undefined, take);
  }

  @Query(() => [CounterpartyUnion], {
    description:
      'Список подрядчиков (без сотрудников); опциональный поиск.',
  })
  async contractors(
    @AuthContext() ctx: AuthContextType,
    @Args('search', { type: () => String, nullable: true }) search?: string,
    @Args('take', { type: () => Number, nullable: true }) take?: number,
  ) {
    return this.supplierService.getContractors(ctx, search ?? undefined, take);
  }
}
