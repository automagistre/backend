import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { Observable, from, lastValueFrom } from 'rxjs';
import { PrismaService } from '../prisma/prisma.service';
import {
  userIdStore,
  DEFAULT_TENANT_ID,
  setSessionParamsOnClient,
} from '../common/user-id.store';

/**
 * Сохраняет user_id в AsyncLocalStorage и устанавливает app.user_id для Prisma.
 * Выполняется после guard — req.user уже установлен.
 * Хранилище используется внутри $transaction (другой контекст БД).
 */
@Injectable()
export class UserIdInterceptor implements NestInterceptor {
  constructor(private readonly prisma: PrismaService) {}

  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<unknown> {
    const req = this.getRequest(context);
    const userId = (req as { user?: { sub?: string } }).user?.sub;

    return from(
      userIdStore.run(
        { userId, tenantId: DEFAULT_TENANT_ID },
        async () => {
          if (userId) {
            await setSessionParamsOnClient(this.prisma);
          }
          return lastValueFrom(next.handle());
        },
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
