import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

const DEFAULT_TENANT_ID = '1ec13d33-3f41-6e3a-a0cb-02420a000f18';

export interface TenantInfo {
  id: string;
  name: string;
}

@Injectable()
export class TenantService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Список tenant, доступных пользователю (из tenant_permission).
   */
  async getTenantsForUser(userId: string): Promise<TenantInfo[]> {
    const rows = await this.prisma.tenant_permission.findMany({
      where: { user_id: userId },
      select: { tenant: { select: { id: true, name: true } } },
    });
    return rows.map((r) => ({ id: r.tenant.id, name: r.tenant.name }));
  }

  /**
   * Проверяет доступ (user_id, tenant_id) в tenant_permission.
   */
  async checkAccess(userId: string, tenantId: string): Promise<boolean> {
    const found = await this.prisma.tenant_permission.findFirst({
      where: { user_id: userId, tenant_id: tenantId },
    });
    return !!found;
  }

  /**
   * @deprecated Используйте ctx.tenantId из @AuthContext
   * Получает tenantId из PostgreSQL переменной app.tenant_id
   */
  async getTenantId(): Promise<string> {
    try {
      const result = await this.prisma.$queryRawUnsafe<
        Array<{ current_setting: string }>
      >(`SELECT current_setting('app.tenant_id', true) as current_setting`);
      const tenantId = result[0]?.current_setting?.trim();
      return tenantId && tenantId !== '' ? tenantId : DEFAULT_TENANT_ID;
    } catch {
      return DEFAULT_TENANT_ID;
    }
  }

  /**
   * @deprecated Только для миграции и обратной совместимости
   */
  getDefaultTenantId(): string {
    return DEFAULT_TENANT_ID;
  }
}
