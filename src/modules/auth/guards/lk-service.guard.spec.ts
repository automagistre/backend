import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtPayload } from '../dto/jwt.payload';
import { LkServiceGuard } from './lk-service.guard';

function makeContext(user?: Partial<JwtPayload>): ExecutionContext {
  return {
    getType: () => 'http',
    getArgs: () => [],
    getArgByIndex: () => undefined,
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as unknown as ExecutionContext;
}

function makeGuard(skipCheck = false): LkServiceGuard {
  const values: Record<string, unknown> = {
    'auth.skipCheck': skipCheck,
    'auth.lkServiceClientIds': ['automagistre-edge'],
  };
  return new LkServiceGuard({
    get: (key: string) => values[key],
  } as unknown as ConfigService);
}

describe('LkServiceGuard', () => {
  it('пускает service-account из списка', () => {
    const ctx = makeContext({
      isServiceAccount: true,
      clientId: 'automagistre-edge',
    });
    expect(makeGuard().canActivate(ctx)).toBe(true);
  });

  it('не пускает JWT сотрудника', () => {
    const ctx = makeContext({
      sub: 'user',
      email: 'u@example.com',
      clientId: 'automagistre-edge',
    });
    expect(() => makeGuard().canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('не пускает service-account чужого клиента', () => {
    const ctx = makeContext({ isServiceAccount: true, clientId: 'other' });
    expect(() => makeGuard().canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('не пускает без токена', () => {
    expect(() => makeGuard().canActivate(makeContext())).toThrow(
      ForbiddenException,
    );
  });

  it('пропускает при AUTH_SKIP_CHECK', () => {
    expect(makeGuard(true).canActivate(makeContext())).toBe(true);
  });
});
