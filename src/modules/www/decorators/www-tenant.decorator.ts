import {
  createParamDecorator,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';

export interface WwwTenantContext {
  tenantId: string;
  tenantGroupId: string;
}

interface ReqWithTenant {
  tenantId?: string;
  tenantGroupId?: string;
}

/**
 * Возвращает tenant-контекст для публичных www-резолверов.
 * Tenant вытаскивается из header `X-Tenant-Public-Id` (или path-сегмента
 * `/api/www/:publicId`, который переписывается fastify-хуком в header)
 * через GraphQL context-фабрику WwwModule.
 */
export const WwwTenant = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): WwwTenantContext => {
    const gqlCtx = GqlExecutionContext.create(ctx);
    const req = gqlCtx.getContext<{ req?: ReqWithTenant }>().req;

    if (!req?.tenantId || !req?.tenantGroupId) {
      throw new ForbiddenException(
        'Tenant required: укажите валидный X-Tenant-Public-Id или path /api/www/:publicId',
      );
    }

    return {
      tenantId: req.tenantId,
      tenantGroupId: req.tenantGroupId,
    };
  },
);
