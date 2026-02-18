import {
  createParamDecorator,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { JwtPayload } from '../../modules/auth/dto/jwt.payload';

export interface CurrentUserOptions {
  /** Если true, при отсутствии user бросает UnauthorizedException. */
  required?: boolean;
}

/**
 * Возвращает текущего пользователя из req.user (GraphQL или HTTP).
 * Заполняется guard'ом (token introspection / local strategy).
 * @param options.required — при true бросает UnauthorizedException, если user отсутствует.
 */
export const CurrentUser = createParamDecorator(
  (options: CurrentUserOptions | undefined, ctx: ExecutionContext): JwtPayload | undefined => {
    let user: JwtPayload | undefined;
    try {
      const gqlCtx = GqlExecutionContext.create(ctx);
      user = gqlCtx.getContext().req?.user as JwtPayload | undefined;
    } catch {
      const req = ctx.switchToHttp().getRequest();
      user = req?.user as JwtPayload | undefined;
    }
    if (options?.required === true && !user) {
      throw new UnauthorizedException('Authentication required');
    }
    return user;
  },
);
