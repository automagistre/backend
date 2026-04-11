import {
  createParamDecorator,
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import type {
  AuthContext as AuthContextType,
  UserContext,
} from '../user-id.store';

interface ReqWithCtx {
  ctx?: UserContext;
  user?: { sub?: string };
  tenantId?: string;
  tenantGroupId?: string;
}

function getReqWithFallback(ctx: ExecutionContext): ReqWithCtx | undefined {
  try {
    const gqlCtx = GqlExecutionContext.create(ctx);
    const gqlContext: { req?: ReqWithCtx } | undefined = gqlCtx.getContext();
    const gqlReq = gqlContext?.req;
    if (gqlReq) {
      return gqlReq;
    }
  } catch {
    // Not GraphQL context
  }
  const req = ctx.switchToHttp().getRequest<ReqWithCtx>();
  return req;
}

/**
 * Возвращает полный контекст { userId, tenantId, tenantGroupId } — все обязательны.
 * Используй с @RequireTenant() на резолвере.
 */
export const AuthContext = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthContextType => {
    const req = getReqWithFallback(ctx);
    const context = req?.ctx;
    const userId = context?.userId || req?.user?.sub;
    const tenantId = context?.tenantId ?? req?.tenantId ?? null;
    const tenantGroupId = context?.tenantGroupId ?? req?.tenantGroupId ?? null;

    if (!userId) {
      throw new UnauthorizedException('Authentication required');
    }
    if (!tenantId) {
      throw new ForbiddenException('Tenant context required');
    }
    if (!tenantGroupId) {
      throw new ForbiddenException('Tenant group context required');
    }
    return {
      userId,
      tenantId,
      tenantGroupId,
    };
  },
);

/**
 * Возвращает контекст { userId, tenantId: string | null }.
 * Используй с @SkipTenant() для резолверов без tenant (me, auth).
 */
export const CurrentUserContext = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): UserContext => {
    const req = getReqWithFallback(ctx);
    const context = req?.ctx;
    const userId = context?.userId || req?.user?.sub;
    const tenantId = context?.tenantId ?? req?.tenantId ?? null;
    const tenantGroupId = context?.tenantGroupId ?? req?.tenantGroupId ?? null;

    if (!userId) {
      throw new UnauthorizedException('Authentication required');
    }
    return {
      userId,
      tenantId,
      tenantGroupId,
    };
  },
);
