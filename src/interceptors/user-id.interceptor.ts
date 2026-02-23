import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { Observable } from 'rxjs';
import type { UserContext } from '../common/user-id.store';

/** Расширение req с ctx и tenantId */
interface ReqWithCtx {
  user?: { sub?: string };
  tenantId?: string;
  tenantGroupId?: string;
  ctx?: UserContext;
}

/**
 * Агрегирует req.ctx = { userId, tenantId, tenantGroupId } для декораторов @AuthContext/@CurrentUserContext.
 * tenantId и tenantGroupId заполняются TenantGuard, userId из JWT.
 */
@Injectable()
export class UserIdInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = this.getRequest(context) as ReqWithCtx;
    const userId = req.user?.sub ?? '';
    const tenantId = req.tenantId ?? null;
    const tenantGroupId = req.tenantGroupId ?? null;

    req.ctx = { userId, tenantId, tenantGroupId };

    return next.handle();
  }

  private getRequest(context: ExecutionContext): unknown {
    try {
      const ctx = GqlExecutionContext.create(context);
      const gqlReq = ctx.getContext().req;
      if (gqlReq) return gqlReq;
    } catch {
      // Не GraphQL контекст
    }
    return context.switchToHttp().getRequest();
  }
}
