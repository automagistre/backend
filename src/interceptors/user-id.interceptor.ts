import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { Observable } from 'rxjs';
import type { UserContext } from '../common/user-id.store';
import { AppUserService } from '../modules/app-user/app-user.service';

interface ReqWithCtx {
  user?: { sub?: string; name?: string; email?: string };
  tenantId?: string;
  tenantGroupId?: string;
  ctx?: UserContext;
}

/**
 * Агрегирует req.ctx = { userId, tenantId, tenantGroupId } для декораторов @AuthContext/@CurrentUserContext.
 * При первом запросе пользователя — upsert профиля в app_user из данных токена.
 */
@Injectable()
export class UserIdInterceptor implements NestInterceptor {
  private readonly syncedUsers = new Set<string>();

  constructor(private readonly appUserService: AppUserService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = this.getRequest(context) as ReqWithCtx;
    const userId = req.user?.sub ?? '';
    const tenantId = req.tenantId ?? null;
    const tenantGroupId = req.tenantGroupId ?? null;

    req.ctx = { userId, tenantId, tenantGroupId };

    if (userId && !this.syncedUsers.has(userId)) {
      this.syncedUsers.add(userId);
      const displayName = req.user?.name || req.user?.email || userId;
      this.appUserService.upsert(userId, displayName).catch(() => {});
    }

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
