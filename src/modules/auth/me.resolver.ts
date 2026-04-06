import { Query, Resolver } from '@nestjs/graphql';
import { MeModel } from './models/me.model';
import { TenantService } from 'src/common/services/tenant.service';
import { AppUserLoader } from 'src/modules/app-user/app-user.loader';
import { CurrentUserContext } from 'src/common/decorators/auth-context.decorator';
import { SkipTenant } from 'src/common/decorators/skip-tenant.decorator';
import type { UserContext } from 'src/common/user-id.store';

@Resolver()
export class MeResolver {
  constructor(
    private readonly tenantService: TenantService,
    private readonly appUserLoader: AppUserLoader,
  ) {}

  @SkipTenant()
  @Query(() => MeModel, {
    description: 'Текущий пользователь и доступные tenant',
  })
  async me(@CurrentUserContext() ctx: UserContext): Promise<MeModel> {
    const [tenants, profile] = await Promise.all([
      this.tenantService.getTenantsForUser(ctx.userId),
      this.appUserLoader.load(ctx.userId),
    ]);
    return { profile, tenants };
  }
}
