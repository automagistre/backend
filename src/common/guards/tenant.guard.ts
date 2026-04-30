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
const X_TENANT_ID_COOKIE = 'X-Tenant-Id';
const X_TENANT_PUBLIC_ID = 'x-tenant-public-id';

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
      headers?: Record<string, string | string[] | undefined>;
    };
    const tenantId = this.getTenantId(req);

    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      handler,
      cls,
    ]);
    if (isPublic) {
      // Для публичных www-эндпоинтов (path /api/www/:publicId или header
      // X-Tenant-Public-Id) — резолвим tenant из publicId и кладём в req,
      // чтобы декоратор @WwwTenant() мог его достать.
      await this.resolveTenantFromPublicId(req);
      return true;
    }

    // Приоритет: декоратор на методе > декоратор на классе
    // @RequireTenant() требует tenant, @SkipTenant() пропускает проверку
    const requireOnHandler = this.reflector.get<boolean>(
      REQUIRE_TENANT_KEY,
      handler,
    );
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

  /**
   * Если в запросе есть header `X-Tenant-Public-Id` (5-значный publicId),
   * резолвит его в tenantId/tenantGroupId через TenantService и кладёт в req.
   * Используется для публичных www-операций (`@Public()` резолверов),
   * у которых нет JWT и обычного X-Tenant-Id.
   */
  private async resolveTenantFromPublicId(req: {
    tenantId?: string;
    tenantGroupId?: string;
    headers?: Record<string, string | string[] | undefined>;
  }): Promise<void> {
    if (req.tenantId) return;
    const headerVal = req.headers?.[X_TENANT_PUBLIC_ID];
    const headerStr = Array.isArray(headerVal) ? headerVal[0] : headerVal;
    if (!headerStr) return;
    const publicId = Number.parseInt(String(headerStr), 10);
    if (!Number.isFinite(publicId)) return;
    const tenant = await this.tenantService.findByPublicId(publicId);
    if (tenant) {
      req.tenantId = tenant.id;
      req.tenantGroupId = tenant.groupId;
    }
  }

  private getTenantId(req: unknown): string | undefined {
    const reqObj = req as {
      headers?: Record<string, string | string[] | undefined>;
      cookies?: Record<string, string | undefined>;
    };

    // Сначала проверяем заголовок
    const headers = reqObj.headers;
    const headerValue = headers?.[X_TENANT_ID];
    if (typeof headerValue === 'string' && headerValue.trim()) {
      return headerValue.trim();
    }
    if (Array.isArray(headerValue) && headerValue[0]) {
      const v = String(headerValue[0]).trim();
      if (v) return v;
    }

    // Затем проверяем cookie
    const cookieValue = reqObj.cookies?.[X_TENANT_ID_COOKIE];
    if (typeof cookieValue === 'string' && cookieValue.trim()) {
      return cookieValue.trim();
    }

    // Парсим cookie из заголовка (для WebSocket)
    const cookieHeader = headers?.cookie;
    if (typeof cookieHeader === 'string') {
      const match = cookieHeader.match(
        new RegExp(`${X_TENANT_ID_COOKIE}=([^;]+)`),
      );
      if (match?.[1]) {
        return match[1].trim();
      }
    }

    return undefined;
  }
}
