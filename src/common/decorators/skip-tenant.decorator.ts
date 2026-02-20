import { SetMetadata } from '@nestjs/common';

export const SKIP_TENANT_KEY = 'skipTenant';
export const REQUIRE_TENANT_KEY = 'requireTenant';

/** Пропустить TenantGuard (для me, auth и т.п.) */
export const SkipTenant = () => SetMetadata(SKIP_TENANT_KEY, true);

/** Требовать X-Tenant-Id и проверять доступ (для мигрированных роутов) */
export const RequireTenant = () => SetMetadata(REQUIRE_TENANT_KEY, true);
