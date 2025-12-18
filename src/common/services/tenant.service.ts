import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

const DEFAULT_TENANT_ID = '1ec13d33-3f41-6e3a-a0cb-02420a000f18';

@Injectable()
export class TenantService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Получает tenantId из PostgreSQL переменной app.tenant_id
   * Если переменная не установлена или пустая, возвращает дефолтный tenantId
   */
  async getTenantId(): Promise<string> {
    try {
      const result = await this.prisma.$queryRawUnsafe<Array<{ current_setting: string }>>(
        `SELECT current_setting('app.tenant_id', true) as current_setting`
      );
      const tenantId = result[0]?.current_setting?.trim();
      // Если переменная не установлена или пустая, возвращаем дефолтный tenantId
      return tenantId && tenantId !== '' ? tenantId : DEFAULT_TENANT_ID;
    } catch {
      // В случае ошибки возвращаем дефолтный tenantId
      return DEFAULT_TENANT_ID;
    }
  }

  /**
   * Возвращает дефолтный tenantId
   */
  getDefaultTenantId(): string {
    return DEFAULT_TENANT_ID;
  }
}

