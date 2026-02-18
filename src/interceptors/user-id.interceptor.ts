import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { Observable, from, lastValueFrom } from 'rxjs';
import { userIdStore, DEFAULT_TENANT_ID } from '../common/user-id.store';

/**
 * Сохраняет userId и tenantId в AsyncLocalStorage для доступа через getRequestContext().
 * Выполняется после guard — req.user уже установлен.
 */
@Injectable()
export class UserIdInterceptor implements NestInterceptor {
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<unknown> {
    const req = this.getRequest(context);
    const userId = (req as { user?: { sub?: string } }).user?.sub;

    return from(
      userIdStore.run(
        { userId, tenantId: DEFAULT_TENANT_ID },
        () => lastValueFrom(next.handle()),
      ),
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
