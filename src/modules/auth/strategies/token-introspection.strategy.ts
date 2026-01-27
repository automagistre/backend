import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-http-bearer';
import { Injectable, UnauthorizedException } from '@nestjs/common';
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

      const result = await response.json();

      if (!result.active) {
        throw new UnauthorizedException('Token is not active');
      }

      // The introspection result contains the token payload
      return {
        sub: result.sub,
        email: result.email,
        // map other fields as needed
      };
    } catch (error) {
      console.error('Token introspection failed:', error);
      throw new UnauthorizedException(
        'Failed to verify token with the provider',
      );
    }
  }
}
