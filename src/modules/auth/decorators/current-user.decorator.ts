import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { JwtPayload } from '../dto/jwt.payload';

/**
 * Parameter decorator to get the current user from the request.
 * Works for both REST and GraphQL.
 */
export const CurrentUser = createParamDecorator(
  (data: unknown, context: ExecutionContext): JwtPayload => {
    const ctx = GqlExecutionContext.create(context);
    const gqlReq = ctx.getContext().req;
    if (gqlReq) {
      return gqlReq.user;
    }
    const httpReq = context.switchToHttp().getRequest();
    return httpReq.user;
  },
);
