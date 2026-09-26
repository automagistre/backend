import { ExecutionContext, Injectable } from '@nestjs/common';
import { GqlExecutionContext, GqlContextType } from '@nestjs/graphql';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { JwtPayload } from 'src/modules/auth/dto/jwt.payload';

interface ThrottledRequest {
  ip?: string;
  headers: Record<string, string | string[] | undefined>;
  user?: JwtPayload;
}

interface GqlHttpContext {
  req?: ThrottledRequest;
  res?: unknown;
}

/**
 * ThrottlerGuard для HTTP и GraphQL. Корзина — пользователь из JWT,
 * для service-account ЛК — ещё и телефон клиента, для анонимов — IP.
 * WebSocket-подписки (нет res) не лимитируются.
 */
@Injectable()
export class GqlThrottlerGuard extends ThrottlerGuard {
  protected getRequestResponse(context: ExecutionContext) {
    if (context.getType<GqlContextType>() === 'graphql') {
      const ctx =
        GqlExecutionContext.create(context).getContext<GqlHttpContext>();
      return {
        req: ctx.req as Record<string, any>,
        res: ctx.res as Record<string, any>,
      };
    }
    return super.getRequestResponse(context);
  }

  protected async shouldSkip(context: ExecutionContext): Promise<boolean> {
    const { req, res } = this.getRequestResponse(context);
    return Promise.resolve(!req || !res);
  }

  protected async getTracker(req: Record<string, any>): Promise<string> {
    const { user, headers, ip } = req as ThrottledRequest;
    if (user?.isServiceAccount) {
      const phone = headers['x-me-customer-phone'];
      return Promise.resolve(
        `svc:${user.clientId ?? user.sub}:${typeof phone === 'string' ? phone : ''}`,
      );
    }
    if (user?.sub) {
      return Promise.resolve(`user:${user.sub}`);
    }
    return Promise.resolve(`ip:${ip ?? 'unknown'}`);
  }
}
