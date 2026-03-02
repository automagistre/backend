import { Query, Resolver, ResolveField } from '@nestjs/graphql';
import { AuthContext } from 'src/common/decorators/auth-context.decorator';
import type { AuthContext as AuthContextType } from 'src/common/user-id.store';
import { SettingsModel } from './settings.model';
import { SettingsService } from './settings.service';
import { TenantRequisitesModel } from './models/tenant-requisites.model';
import { RequireTenant } from 'src/common/decorators/skip-tenant.decorator';

@RequireTenant()
@Resolver(() => SettingsModel)
export class SettingsResolver {
  constructor(private readonly settingsService: SettingsService) {}

  @Query(() => SettingsModel, {
    description: 'Настройки приложения',
  })
  async settings(): Promise<SettingsModel> {
    return this.settingsService.getSettings();
  }

  @ResolveField(() => TenantRequisitesModel, { nullable: true })
  async tenantRequisites(
    @AuthContext() ctx: AuthContextType,
  ): Promise<TenantRequisitesModel | null> {
    return this.settingsService.getTenantRequisites(ctx.tenantId);
  }
}
