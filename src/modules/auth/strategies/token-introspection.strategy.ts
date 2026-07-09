import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-http-bearer';
import {
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtPayload } from '../dto/jwt.payload';

@Injectable()
export class TokenIntrospectionStrategy extends PassportStrategy(
  Strategy,
  'token-introspection',
) {
  constructor(private readonly configService: ConfigService) {
    super();
  }

  async validate(token: string): Promise<JwtPayload> {
    const introspectionEndpoint = this.configService.get<string>(
      'auth.keycloak.introspectionEndpoint',
    ) as string;
    const clientId = this.configService.get<string>(
      'auth.keycloak.clientId',
    ) as string;
    const clientSecret = this.configService.get<string>(
      'auth.keycloak.clientSecret',
    ) as string;

    const params = new URLSearchParams();
    params.append('token', token);
    params.append('client_id', clientId);
    params.append('client_secret', clientSecret);

    try {
      const response = await fetch(introspectionEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params,
      });

      // 5xx/4xx от Keycloak или прокси — это не «токен неактивен».
      // Без этой проверки временный сбой Keycloak разлогинивал пользователей.
      if (!response.ok) {
        const body = await response.text();
        console.error(
          `Token introspection HTTP ${response.status}:`,
          body.slice(0, 300),
        );
        throw new ServiceUnavailableException(
          'Auth provider temporarily unavailable',
        );
      }

      const result = (await response.json()) as {
        active?: boolean;
        sub?: string;
        email?: string;
        name?: string;
        preferred_username?: string;
        realm_access?: { roles?: string[] };
        resource_access?: Record<string, { roles?: string[] }>;
      };

      if (!result.active) {
        throw new UnauthorizedException('Token is not active');
      }
      if (!result.sub) {
        throw new UnauthorizedException(
          'Токен не содержит необходимых данных. Войдите снова.',
        );
      }

      // Service-account токены (client_credentials) не имеют email.
      // Обычные пользовательские токены email обязан содержать.
      const isServiceAccount = !result.email && !!result.preferred_username?.startsWith('service-account-');
      if (!result.email && !isServiceAccount) {
        throw new UnauthorizedException(
          'Токен не содержит необходимых данных. Войдите снова.',
        );
      }

      const apiRoles = result.resource_access?.['api-oauth']?.roles ?? [];
      const realmRoles = result.realm_access?.roles ?? [];

      return {
        sub: result.sub,
        email: result.email ?? result.preferred_username ?? result.sub,
        name: result.name,
        preferred_username: result.preferred_username,
        roles: apiRoles.length > 0 ? apiRoles : undefined,
        realm_roles: realmRoles.length > 0 ? realmRoles : undefined,
      };
    } catch (error) {
      if (
        error instanceof UnauthorizedException ||
        error instanceof ServiceUnavailableException
      ) {
        throw error;
      }
      console.error('Token introspection failed:', error);
      // Сетевая ошибка/невалидный JSON — транзиентный сбой, не повод для разлогина
      throw new ServiceUnavailableException(
        'Auth provider temporarily unavailable',
      );
    }
  }
}
