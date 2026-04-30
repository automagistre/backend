import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

export interface TenantInfo {
  id: string;
  name: string;
}

export interface TenantWithGroup {
  tenantId: string;
  groupId: string;
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
   * Проверяет доступ (user_id, tenant_id) и возвращает groupId если доступ есть.
   */
  async checkAccessAndGetGroup(
    userId: string,
    tenantId: string,
  ): Promise<TenantWithGroup | null> {
    const permission = await this.prisma.tenant_permission.findFirst({
      where: { user_id: userId, tenant_id: tenantId },
      select: {
        tenant: {
          select: { id: true, group_id: true },
        },
      },
    });

    if (!permission) {
      return null;
    }

    return {
      tenantId: permission.tenant.id,
      groupId: permission.tenant.group_id,
    };
  }

  /**
   * Получает tenantGroupId по tenantId
   */
  async getTenantGroupId(tenantId: string): Promise<string | null> {
    const tenant = await this.prisma.tenant.findFirst({
      where: { id: tenantId },
      select: { group_id: true },
    });
    return tenant?.group_id ?? null;
  }

  /**
   * Резолв tenant по публичному 5-значному идентификатору (tenant.public_id).
   * Используется в публичных интеграциях (www, UIS) — чтобы не светить UUID в URL.
   */
  async findByPublicId(
    publicId: number,
  ): Promise<{ id: string; groupId: string } | null> {
    if (!Number.isInteger(publicId) || publicId < 10000 || publicId > 99999) {
      return null;
    }
    const tenant = await this.prisma.tenant.findFirst({
      where: { public_id: publicId },
      select: { id: true, group_id: true },
    });
    return tenant ? { id: tenant.id, groupId: tenant.group_id } : null;
  }

  /**
   * Возвращает свободный 5-значный public_id (10000-99999).
   * Нужен при создании нового тенанта, чтобы не дублировать существующие.
   */
  async generateUniquePublicId(): Promise<number> {
    for (let attempt = 0; attempt < 50; attempt++) {
      const candidate = 10000 + Math.floor(Math.random() * 90000);
      const exists = await this.prisma.tenant.findFirst({
        where: { public_id: candidate },
        select: { id: true },
      });
      if (!exists) return candidate;
    }
    throw new Error('Не удалось сгенерировать свободный public_id за 50 попыток');
  }
}
