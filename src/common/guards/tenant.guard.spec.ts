import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Public } from 'src/modules/auth/decorators/public.decorator';
import { RequireTenant, SkipTenant } from '../decorators/skip-tenant.decorator';
import { TenantService } from '../services/tenant.service';
import { TenantGuard } from './tenant.guard';

type Req = {
  user?: { sub?: string };
  headers: Record<string, string>;
  tenantId?: string;
  tenantGroupId?: string;
};

class Plain {
  handler() {}
}

@SkipTenant()
class Skipped {
  handler() {}
  @RequireTenant()
  required() {}
}

@Public()
class Open {
  handler() {}
}

function makeContext(
  cls: new () => object,
  method: string,
  req: Req,
): ExecutionContext {
  return {
    getType: () => 'http',
    getArgs: () => [],
    getArgByIndex: () => undefined,
    getHandler: () => (cls.prototype as Record<string, unknown>)[method],
    getClass: () => cls,
    switchToHttp: () => ({ getRequest: () => req }),
  } as unknown as ExecutionContext;
}

describe('TenantGuard', () => {
  const tenantService = {
    checkAccessAndGetGroup: jest.fn(),
    findByPublicId: jest.fn(),
  };
  const guard = new TenantGuard(
    tenantService as unknown as TenantService,
    new Reflector(),
  );

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('без декораторов требует X-Tenant-Id', async () => {
    const req: Req = { user: { sub: 'u1' }, headers: {} };
    await expect(
      guard.canActivate(makeContext(Plain, 'handler', req)),
    ).rejects.toThrow(ForbiddenException);
  });

  it('без декораторов отказывает, если нет доступа к tenant', async () => {
    tenantService.checkAccessAndGetGroup.mockResolvedValue(null);
    const req: Req = { user: { sub: 'u1' }, headers: { 'x-tenant-id': 't1' } };
    await expect(
      guard.canActivate(makeContext(Plain, 'handler', req)),
    ).rejects.toThrow(ForbiddenException);
  });

  it('без декораторов пускает при доступе и кладёт tenant в req', async () => {
    tenantService.checkAccessAndGetGroup.mockResolvedValue({
      tenantId: 't1',
      groupId: 'g1',
    });
    const req: Req = { user: { sub: 'u1' }, headers: { 'x-tenant-id': 't1' } };
    await expect(
      guard.canActivate(makeContext(Plain, 'handler', req)),
    ).resolves.toBe(true);
    expect(req.tenantId).toBe('t1');
    expect(req.tenantGroupId).toBe('g1');
  });

  it('@SkipTenant на классе пропускает без tenant', async () => {
    const req: Req = { user: { sub: 'u1' }, headers: {} };
    await expect(
      guard.canActivate(makeContext(Skipped, 'handler', req)),
    ).resolves.toBe(true);
  });

  it('@RequireTenant на методе перекрывает @SkipTenant класса', async () => {
    const req: Req = { user: { sub: 'u1' }, headers: {} };
    await expect(
      guard.canActivate(makeContext(Skipped, 'required', req)),
    ).rejects.toThrow(ForbiddenException);
  });

  it('@SkipTenant резолвит tenant по X-Tenant-Public-Id', async () => {
    tenantService.findByPublicId.mockResolvedValue({ id: 't2', groupId: 'g2' });
    const req: Req = {
      user: { sub: 'sa' },
      headers: { 'x-tenant-public-id': '34106' },
    };
    await expect(
      guard.canActivate(makeContext(Skipped, 'handler', req)),
    ).resolves.toBe(true);
    expect(tenantService.findByPublicId).toHaveBeenCalledWith(34106);
    expect(req.tenantGroupId).toBe('g2');
  });

  it('@Public пропускает без пользователя', async () => {
    const req: Req = { headers: {} };
    await expect(
      guard.canActivate(makeContext(Open, 'handler', req)),
    ).resolves.toBe(true);
  });
});
