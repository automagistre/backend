import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-http-bearer';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthenticationError } from '@nestjs/apollo';
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
        throw new AuthenticationError('Token is not active');
      }
      if (!result.sub || !result.email) {
        throw new AuthenticationError(
          'Токен не содержит необходимых данных. Войдите снова.',
        );
      }

      const apiRoles = result.resource_access?.['api-oauth']?.roles ?? [];
      const realmRoles = result.realm_access?.roles ?? [];

      return {
        sub: result.sub,
        email: result.email,
        name: result.name,
        preferred_username: result.preferred_username,
        roles: apiRoles.length > 0 ? apiRoles : undefined,
        realm_roles: realmRoles.length > 0 ? realmRoles : undefined,
      };
    } catch (error) {
      if (error instanceof AuthenticationError) {
        throw error;
      }
      console.error('Token introspection failed:', error);
      throw new AuthenticationError(
        'Failed to verify token with the provider',
      );
    }
  }
}
