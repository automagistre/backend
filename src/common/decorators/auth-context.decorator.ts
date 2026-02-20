import {
  createParamDecorator,
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import type { AuthContext as AuthContextType, UserContext } from '../user-id.store';

interface ReqWithCtx {
  ctx?: UserContext;
}

function getReqCtx(ctx: ExecutionContext): UserContext | undefined {
  let req: ReqWithCtx;
  try {
    const gqlCtx = GqlExecutionContext.create(ctx);
    req = gqlCtx.getContext().req as ReqWithCtx;
  } catch {
    req = ctx.switchToHttp().getRequest() as ReqWithCtx;
  }
  return req?.ctx;
}

/**
 * Возвращает полный контекст { userId, tenantId } — оба обязательны.
 * Используй с @RequireTenant() на резолвере.
 */
export const AuthContext = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthContextType => {
    const context = getReqCtx(ctx);
    if (!context?.userId) {
      throw new UnauthorizedException('Authentication required');
    }
    if (!context.tenantId) {
      throw new ForbiddenException('Tenant context required');
    }
    return { userId: context.userId, tenantId: context.tenantId };
  },
);

/**
 * Возвращает контекст { userId, tenantId: string | null }.
 * Используй с @SkipTenant() для резолверов без tenant (me, auth).
 */
export const CurrentUserContext = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): UserContext => {
    const context = getReqCtx(ctx);
    if (!context?.userId) {
      throw new UnauthorizedException('Authentication required');
    }
    return context;
  },
);
