import {
  Args,
  ID,
  Mutation,
  Parent,
  Query,
  Resolver,
  ResolveField,
} from '@nestjs/graphql';
import { AuthContext } from 'src/common/decorators/auth-context.decorator';
import type { AuthContext as AuthContextType } from 'src/common/user-id.store';
import { SettingsModel } from './settings.model';
import { SettingsService } from './settings.service';
import { TenantRequisitesModel } from './models/tenant-requisites.model';
import { RequireTenant } from 'src/common/decorators/skip-tenant.decorator';
import { UpdateSettingsInput } from './inputs/update-settings.input';
import { TenantOrganizationModel } from './models/tenant-organization.model';
import {
  TenantOrganizationService,
  toPrintRequisites,
} from './tenant-organization.service';

@RequireTenant()
@Resolver(() => SettingsModel)
export class SettingsResolver {
  constructor(
    private readonly settingsService: SettingsService,
    private readonly tenantOrganizationService: TenantOrganizationService,
  ) {}

  @Query(() => SettingsModel, {
    description: 'Настройки приложения',
  })
  async settings(@AuthContext() ctx: AuthContextType): Promise<SettingsModel> {
    return this.settingsService.getSettings(ctx.tenantId);
  }

  @Mutation(() => SettingsModel, {
    description:
      'Обновить настройки сервиса: ключи, название и юр. лица одним патчем',
  })
  async updateSettings(
    @AuthContext() ctx: AuthContextType,
    @Args('input') input: UpdateSettingsInput,
  ): Promise<SettingsModel> {
    return this.settingsService.updateSettings(ctx, input);
  }

  @ResolveField(() => String)
  async tenantName(@AuthContext() ctx: AuthContextType): Promise<string> {
    return this.settingsService.getTenantName(ctx.tenantId);
  }

  @ResolveField(() => Boolean)
  async callsConfigured(@AuthContext() ctx: AuthContextType): Promise<boolean> {
    return this.settingsService.hasActiveCallRouting(ctx.tenantId);
  }

  @ResolveField(() => [TenantOrganizationModel], {
    description: 'Юр. лица сервиса, основное первым',
  })
  async tenantOrganizations(
    @AuthContext() ctx: AuthContextType,
  ): Promise<TenantOrganizationModel[]> {
    return this.tenantOrganizationService.list(ctx.tenantId);
  }

  @ResolveField(() => TenantRequisitesModel, {
    nullable: true,
    description:
      'Реквизиты для печати: указанная организация сервиса или основная',
  })
  async tenantRequisites(
    @AuthContext() ctx: AuthContextType,
    @Parent() settings: SettingsModel,
    @Args('organizationId', { type: () => ID, nullable: true })
    organizationId?: string | null,
  ): Promise<TenantRequisitesModel | null> {
    const organization = await this.tenantOrganizationService.findForPrint(
      ctx.tenantId,
      organizationId,
    );
    return organization ? toPrintRequisites(organization, settings) : null;
  }
}
