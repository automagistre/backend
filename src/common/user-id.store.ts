import { AsyncLocalStorage } from 'node:async_hooks';

const DEFAULT_TENANT_ID = '1ec13d33-3f41-6e3a-a0cb-02420a000f18';

/** UUID для фоновых задач (cron, queue) без HTTP-контекста. */
export const SYSTEM_USER_ID = '24602e10-629b-4f23-8d8b-1cca08fb8a84';

/** Полный контекст с обязательным tenant — для @RequireTenant резолверов. */
export interface AuthContext {
  userId: string;
  tenantId: string;
}

/** Контекст без tenant — для @SkipTenant резолверов (me, auth). */
export interface UserContext {
  userId: string;
  tenantId: string | null;
}

/** Для getRequestContext — userId может быть undefined вне HTTP-запроса (cron). */
export interface LegacyRequestContext {
  userId: string | undefined;
  tenantId: string;
}

export const userIdStore = new AsyncLocalStorage<LegacyRequestContext>();

export function getRequestContext(): LegacyRequestContext {
  return (
    userIdStore.getStore() ?? {
      userId: undefined,
      tenantId: DEFAULT_TENANT_ID,
    }
  );
}

export { DEFAULT_TENANT_ID };
