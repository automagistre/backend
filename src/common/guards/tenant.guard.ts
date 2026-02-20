import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { GqlExecutionContext } from '@nestjs/graphql';
import { TenantService } from '../services/tenant.service';
import { IS_PUBLIC_KEY } from 'src/modules/auth/decorators/public.decorator';
import {
  SKIP_TENANT_KEY,
  REQUIRE_TENANT_KEY,
} from '../decorators/skip-tenant.decorator';

const X_TENANT_ID = 'x-tenant-id';

@Injectable()
export class TenantGuard implements CanActivate {
  constructor(
    private readonly tenantService: TenantService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const skipTenant = this.reflector.getAllAndOverride<boolean>(SKIP_TENANT_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const requireTenant = this.reflector.getAllAndOverride<boolean>(
      REQUIRE_TENANT_KEY,
      [context.getHandler(), context.getClass()],
    );
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (skipTenant || isPublic || !requireTenant) {
      return true;
    }

    const req = this.getRequest(context);
    const userId = (req as { user?: { sub?: string } }).user?.sub;
    const tenantId = this.getTenantId(req);

    if (!tenantId) {
      throw new ForbiddenException('X-Tenant-Id header required');
    }

    if (!userId) {
      throw new ForbiddenException('Authentication required');
    }

    const hasAccess = await this.tenantService.checkAccess(userId, tenantId);
    if (!hasAccess) {
      throw new ForbiddenException('Access to tenant denied');
    }

    (req as { tenantId?: string }).tenantId = tenantId;
    return true;
  }

  private getRequest(context: ExecutionContext): unknown {
    try {
      const ctx = GqlExecutionContext.create(context);
      const gqlReq = ctx.getContext().req;
      if (gqlReq) return gqlReq;
    } catch {
      // Not GraphQL context
    }
    return context.switchToHttp().getRequest();
  }

  private getTenantId(req: unknown): string | undefined {
    const headers = (req as { headers?: Record<string, string | string[] | undefined> })
      .headers;
    const value = headers?.[X_TENANT_ID];
    if (typeof value === 'string') return value.trim() || undefined;
    if (Array.isArray(value) && value[0]) return String(value[0]).trim() || undefined;
    return undefined;
  }
}
