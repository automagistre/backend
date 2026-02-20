import { Query, Resolver } from '@nestjs/graphql';
import { MeModel } from './models/me.model';
import { TenantService } from 'src/common/services/tenant.service';
import { CurrentUserContext } from 'src/common/decorators/auth-context.decorator';
import { SkipTenant } from 'src/common/decorators/skip-tenant.decorator';
import type { UserContext } from 'src/common/user-id.store';

@Resolver()
export class MeResolver {
  constructor(private readonly tenantService: TenantService) {}

  @SkipTenant()
  @Query(() => MeModel, {
    description: 'Текущий пользователь и доступные tenant',
  })
  async me(@CurrentUserContext() ctx: UserContext): Promise<MeModel> {
    const tenants = await this.tenantService.getTenantsForUser(ctx.userId);
    return { tenants };
  }
}
