import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GqlExecutionContext } from '@nestjs/graphql';
import { JwtPayload } from '../dto/jwt.payload';

interface RequestWithUser {
  user?: JwtPayload;
}

/**
 * Пускает только service-account токены клиентов из `LK_SERVICE_CLIENT_IDS`
 * (BFF личного кабинета). Сотрудник со своим JWT сюда не проходит.
 */
@Injectable()
export class LkServiceGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    if (this.configService.get<boolean>('auth.skipCheck')) {
      return true;
    }

    const user = this.getUser(context);
    const allowed =
      this.configService.get<string[]>('auth.lkServiceClientIds') ?? [];

    if (
      user?.isServiceAccount &&
      user.clientId &&
      allowed.includes(user.clientId)
    ) {
      return true;
    }
    throw new ForbiddenException('Доступ только для сервиса личного кабинета');
  }

  private getUser(context: ExecutionContext): JwtPayload | undefined {
    try {
      const gqlCtx = GqlExecutionContext.create(context).getContext<{
        req?: RequestWithUser;
      }>();
      if (gqlCtx.req) return gqlCtx.req.user;
    } catch {
      // Not GraphQL context
    }
    return context.switchToHttp().getRequest<RequestWithUser>().user;
  }
}
