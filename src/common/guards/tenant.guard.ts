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
    const handler = context.getHandler();
    const cls = context.getClass();

    const req = this.getRequest(context) as {
      tenantId?: string;
      tenantGroupId?: string;
      user?: { sub?: string };
    };
    const tenantId = this.getTenantId(req);

    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [handler, cls]);
    if (isPublic) {
      return true;
    }

    // Приоритет: декоратор на методе > декоратор на классе
    // @RequireTenant() требует tenant, @SkipTenant() пропускает проверку
    const requireOnHandler = this.reflector.get<boolean>(REQUIRE_TENANT_KEY, handler);
    const skipOnHandler = this.reflector.get<boolean>(SKIP_TENANT_KEY, handler);
    const requireOnClass = this.reflector.get<boolean>(REQUIRE_TENANT_KEY, cls);
    const skipOnClass = this.reflector.get<boolean>(SKIP_TENANT_KEY, cls);

    // Определяем итоговое поведение: метод переопределяет класс
    let requireTenant = false;
    if (requireOnHandler !== undefined) {
      requireTenant = requireOnHandler;
    } else if (skipOnHandler !== undefined) {
      requireTenant = false;
    } else if (requireOnClass !== undefined) {
      requireTenant = requireOnClass;
    } else if (skipOnClass !== undefined) {
      requireTenant = false;
    }

    const userId = req.user?.sub;

    // Если есть tenantId и userId — проверяем доступ и получаем groupId
    if (tenantId && userId) {
      const tenantWithGroup = await this.tenantService.checkAccessAndGetGroup(
        userId,
        tenantId,
      );

      if (tenantWithGroup) {
        req.tenantId = tenantWithGroup.tenantId;
        req.tenantGroupId = tenantWithGroup.groupId;
      } else if (requireTenant) {
        throw new ForbiddenException('Access to tenant denied');
      }
    } else if (tenantId) {
      // tenantId есть, но нет userId — сохраняем tenantId без проверки (для @SkipTenant)
      req.tenantId = tenantId;
    }

    if (!requireTenant) {
      return true;
    }

    // Требуется tenant — проверяем наличие
    if (!tenantId) {
      throw new ForbiddenException('X-Tenant-Id header required');
    }

    if (!userId) {
      throw new ForbiddenException('Authentication required');
    }

    // Доступ уже проверен выше, если дошли сюда — всё ок
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
