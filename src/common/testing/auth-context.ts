import type { AuthContext } from 'src/common/user-id.store';

/** Фикстура AuthContext для юнит-тестов. */
export function makeCtx(over: Partial<AuthContext> = {}): AuthContext {
  return {
    userId: 'user-1',
    tenantId: 'tenant-1',
    tenantGroupId: 'group-1',
    ...over,
  };
}
