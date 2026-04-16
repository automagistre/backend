import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from 'src/prisma/prisma.service';

interface KeycloakUserResponse {
  id: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  attributes?: Record<string, string[]>;
}

@Injectable()
export class AppUserService {
  private readonly logger = new Logger(AppUserService.name);
  private serviceAccountToken: string | null = null;
  private tokenExpiresAt = 0;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  async upsert(id: string, displayName: string, personId?: string | null) {
    const data: Record<string, unknown> = { displayName };
    if (personId !== undefined) data.personId = personId;

    return this.prisma.appUser.upsert({
      where: { id },
      create: { id, displayName, ...(personId ? { personId } : {}) },
      update: data,
    });
  }

  async findByIds(ids: string[]) {
    if (ids.length === 0) return [];
    return this.prisma.appUser.findMany({
      where: { id: { in: ids } },
      include: { person: true },
    });
  }

  async findById(id: string) {
    return this.prisma.appUser.findUnique({
      where: { id },
      include: { person: true },
    });
  }

  /**
   * Загружает пользователей из БД, для отсутствующих — запрашивает Keycloak Admin API.
   */
  async loadByIds(ids: string[]): Promise<Map<string, AppUserWithPerson>> {
    const result = new Map<string, AppUserWithPerson>();
    if (ids.length === 0) return result;

    const existing = await this.findByIds(ids);
    for (const user of existing) {
      result.set(user.id, user);
    }

    const missingIds = ids.filter((id) => !result.has(id));
    if (missingIds.length > 0) {
      const fetched = await this.fetchManyFromKeycloak(missingIds);
      for (const user of fetched) {
        result.set(user.id, user);
      }
    }

    return result;
  }

  private async fetchManyFromKeycloak(
    ids: string[],
  ): Promise<AppUserWithPerson[]> {
    const results: AppUserWithPerson[] = [];

    for (const id of ids) {
      try {
        const kcUser = await this.fetchKeycloakUser(id);
        if (!kcUser) continue;

        const displayName =
          [kcUser.lastName, kcUser.firstName].filter(Boolean).join(' ') ||
          kcUser.email ||
          id;

        const personId = kcUser.attributes?.personId?.[0] ?? null;

        const saved = await this.upsert(id, displayName, personId);
        const full = await this.prisma.appUser.findUnique({
          where: { id: saved.id },
          include: { person: true },
        });
        if (full) results.push(full);
      } catch (error) {
        this.logger.warn(`Failed to fetch Keycloak user ${id}: ${error}`);
      }
    }

    return results;
  }

  private async fetchKeycloakUser(
    userId: string,
  ): Promise<KeycloakUserResponse | null> {
    const token = await this.getServiceAccountToken();
    if (!token) return null;

    const baseUrl = this.configService.get<string>('auth.keycloak.baseUrl');
    const realm = this.configService.get<string>('auth.keycloak.realm');
    const url = `${baseUrl}/admin/realms/${realm}/users/${userId}`;

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      this.logger.warn(
        `Keycloak user fetch failed: ${response.status} for ${userId}`,
      );
      return null;
    }

    return response.json() as Promise<KeycloakUserResponse>;
  }

  private async getServiceAccountToken(): Promise<string | null> {
    if (this.serviceAccountToken && Date.now() < this.tokenExpiresAt) {
      return this.serviceAccountToken;
    }

    const tokenEndpoint = this.configService.get<string>(
      'auth.keycloak.tokenEndpoint',
    );
    const clientId = this.configService.get<string>('auth.keycloak.clientId');
    const clientSecret = this.configService.get<string>(
      'auth.keycloak.clientSecret',
    );

    if (!tokenEndpoint || !clientId || !clientSecret) {
      this.logger.warn('Keycloak config missing for service account token');
      return null;
    }

    try {
      const response = await fetch(tokenEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'client_credentials',
          client_id: clientId,
          client_secret: clientSecret,
        }),
      });

      if (!response.ok) {
        this.logger.warn(
          `Service account token request failed: ${response.status}`,
        );
        return null;
      }

      const data = (await response.json()) as {
        access_token: string;
        expires_in: number;
      };
      this.serviceAccountToken = data.access_token;
      this.tokenExpiresAt = Date.now() + (data.expires_in - 30) * 1000;
      return this.serviceAccountToken;
    } catch (error) {
      this.logger.warn(`Service account token error: ${error}`);
      return null;
    }
  }
}

export type AppUserWithPerson = NonNullable<
  Awaited<ReturnType<AppUserService['findById']>>
>;
