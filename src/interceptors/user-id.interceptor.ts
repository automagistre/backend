import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { Observable, from, lastValueFrom } from 'rxjs';
import {
  userIdStore,
  DEFAULT_TENANT_ID,
  type UserContext,
} from '../common/user-id.store';

/** Расширение req с ctx и tenantId */
interface ReqWithCtx {
  user?: { sub?: string };
  tenantId?: string;
  ctx?: UserContext;
}

/**
 * Агрегирует req.ctx = { userId, tenantId } и сохраняет в AsyncLocalStorage.
 * tenantId из req.tenantId (TenantGuard) или null для роутов без tenant.
 */
@Injectable()
export class UserIdInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = this.getRequest(context) as ReqWithCtx;
    const userId = req.user?.sub ?? '';
    const tenantId = req.tenantId ?? null;

    req.ctx = { userId, tenantId };

    const forStore = {
      userId,
      tenantId: tenantId ?? DEFAULT_TENANT_ID,
    };

    return from(
      userIdStore.run(forStore, () => lastValueFrom(next.handle())),
    );
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
