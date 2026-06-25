import {
  Args,
  ID,
  Parent,
  Query,
  ResolveField,
  Resolver,
} from '@nestjs/graphql';
import { AuthContext } from 'src/common/decorators/auth-context.decorator';
import { RequireTenant } from 'src/common/decorators/skip-tenant.decorator';
import type { AuthContext as AuthContextType } from 'src/common/user-id.store';
import { PaginationArgs } from 'src/common/pagination.args';
import { AppUserModel } from '../app-user/models/app-user.model';
import { AppUserLoader } from '../app-user/app-user.loader';
import { AuditLogService } from './audit-log.service';
import { AuditLogEventModel } from './models/audit-log-event.model';
import { PaginatedAuditLog } from './models/paginated-audit-log.model';
import { AuditEntityType } from './enums/audit.enums';

@Resolver(() => AuditLogEventModel)
@RequireTenant()
export class AuditLogResolver {
  constructor(
    private readonly auditLogService: AuditLogService,
    private readonly appUserLoader: AppUserLoader,
  ) {}

  @Query(() => PaginatedAuditLog, {
    description: 'Журнал аудита по агрегату (и его дочерним сущностям)',
  })
  async auditLog(
    @AuthContext() ctx: AuthContextType,
    @Args('rootEntityType', { type: () => AuditEntityType })
    rootEntityType: AuditEntityType,
    @Args('rootEntityId', { type: () => ID }) rootEntityId: string,
    @Args() pagination: PaginationArgs,
    @Args('entityTypes', { type: () => [AuditEntityType], nullable: true })
    entityTypes?: AuditEntityType[],
  ): Promise<PaginatedAuditLog> {
    return this.auditLogService.findByRoot(ctx, {
      rootEntityType,
      rootEntityId,
      entityTypes,
      take: pagination.take,
      skip: pagination.skip,
    });
  }

  @Query(() => PaginatedAuditLog, {
    description: 'Общий журнал активности (все сущности tenant/group)',
  })
  async activityLog(
    @AuthContext() ctx: AuthContextType,
    @Args() pagination: PaginationArgs,
    @Args('entityTypes', { type: () => [AuditEntityType], nullable: true })
    entityTypes?: AuditEntityType[],
    @Args('actorId', { type: () => ID, nullable: true }) actorId?: string,
  ): Promise<PaginatedAuditLog> {
    return this.auditLogService.findActivity(ctx, {
      entityTypes,
      actorId,
      take: pagination.take,
      skip: pagination.skip,
    });
  }

  @ResolveField('actor', () => AppUserModel, { nullable: true })
  async resolveActor(
    @Parent() event: AuditLogEventModel,
  ): Promise<AppUserModel | null> {
    if (!event.actorId) return null;
    return this.appUserLoader.load(event.actorId);
  }
}
