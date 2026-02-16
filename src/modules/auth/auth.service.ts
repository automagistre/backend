import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { JwtPayload } from './dto/jwt.payload';
import { TokensDto, PasswordLoginDto } from './dto/auth.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async exchangeCodeForTokens(
    code: string,
    redirectUri: string,
  ): Promise<TokensDto> {
    const params = new URLSearchParams();
    params.append('grant_type', 'authorization_code');
    params.append(
      'client_id',
      this.configService.get<string>('auth.keycloak.clientId') as string,
    );
    params.append(
      'client_secret',
      this.configService.get<string>('auth.keycloak.clientSecret') as string,
    );
    params.append('code', code);
    params.append('redirect_uri', redirectUri);

    return this.fetchTokens(params);
  }

  async refreshTokens(refreshToken: string): Promise<TokensDto> {
    const params = new URLSearchParams();
    params.append('grant_type', 'refresh_token');
    params.append(
      'client_id',
      this.configService.get<string>('auth.keycloak.clientId') as string,
    );
    params.append(
      'client_secret',
      this.configService.get<string>('auth.keycloak.clientSecret') as string,
    );
    params.append('refresh_token', refreshToken);

    return this.fetchTokens(params);
  }

  async logout(refreshToken: string): Promise<void> {
    const params = new URLSearchParams();
    params.append(
      'client_id',
      this.configService.get<string>('auth.keycloak.clientId') as string,
    );
    params.append(
      'client_secret',
      this.configService.get<string>('auth.keycloak.clientSecret') as string,
    );
    params.append('refresh_token', refreshToken);

    try {
      await fetch(
        this.configService.get<string>(
          'auth.keycloak.logoutEndpoint',
        ) as string,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: params,
        },
      );
    } catch (error) {
      // It's okay if logout fails, we just log it. The user session is terminated on the client anyway.
      console.error('Keycloak logout failed', error);
    }
  }

  private async fetchTokens(params: URLSearchParams): Promise<TokensDto> {
    const tokenEndpoint = this.configService.get<string>(
      'auth.keycloak.tokenEndpoint',
    ) as string;
    try {
      const response = await fetch(tokenEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params,
      });

      if (!response.ok) {
        const errorBody = await response.text();
        console.error(
          `Keycloak token endpoint error (${response.status}):`,
          errorBody.slice(0, 500),
        );

        let message = `Keycloak error (${response.status})`;
        try {
          const errorJson = JSON.parse(errorBody) as {
            error?: string;
            error_description?: string;
          };
          if (
            errorJson.error === 'invalid_grant' ||
            (errorJson.error_description &&
              /code|invalid|expired|used/i.test(errorJson.error_description))
          ) {
            message =
              'Код авторизации недействителен или уже использован. Попробуйте войти снова.';
          } else if (errorJson.error === 'invalid_redirect_uri') {
            message =
              'redirect_uri не совпадает. Проверьте KEYCLOAK_REDIRECT_URI (backend) и NUXT_PUBLIC_KEYCLOAK_REDIRECT_URI (admin).';
          } else {
            message =
              errorJson.error_description || errorJson.error || message;
          }
        } catch {
          if (errorBody.includes('invalid_redirect_uri')) {
            message =
              'redirect_uri не совпадает. Проверьте KEYCLOAK_REDIRECT_URI.';
          } else if (errorBody.includes('invalid_grant') || errorBody.includes('Code')) {
            message =
              'Код авторизации недействителен или уже использован. Попробуйте войти снова.';
          } else {
            message = 'Keycloak вернул ошибку. Проверьте логи бэкенда.';
          }
        }
        throw new UnauthorizedException(message);
      }

      const data = await response.json();
      if (!data?.access_token || !data?.refresh_token) {
        throw new UnauthorizedException(
          'Invalid token response from authentication provider',
        );
      }
      return {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresIn: data.expires_in,
        refreshExpiresIn: data.refresh_expires_in,
      };
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        // Re-throw the specific error from Keycloak
        throw error;
      }
      // This will now log the detailed network error to the console
      console.error(
        'Network or other error communicating with Keycloak:',
        error,
      );
      throw new UnauthorizedException(
        'Failed to communicate with authentication provider. Check server logs for details.',
      );
    }
  }

  /**
   * Generates a JWT access token for the given payload.
   * This can be used for password-based login or for refresh token logic.
   */
  async generateAccessToken(payload: JwtPayload): Promise<string> {
    const accessTokenTtl = this.configService.get<number>(
      'auth.jwt.accessTokenTtl',
    );
    return this.jwtService.sign(payload, {
      secret: this.configService.get<string>('auth.jwt.secret'),
      expiresIn: accessTokenTtl ? `${accessTokenTtl}s` : undefined,
    });
  }

  async loginWithPassword(dto: PasswordLoginDto): Promise<TokensDto> {
    const params = new URLSearchParams();
    params.append('grant_type', 'password');
    params.append(
      'client_id',
      this.configService.get<string>('auth.keycloak.clientId') as string,
    );
    params.append(
      'client_secret',
      this.configService.get<string>('auth.keycloak.clientSecret') as string,
    );
    params.append('username', dto.username);
    params.append('password', dto.password);

    return this.fetchTokens(params);
  }

  // Add methods for refresh tokens, password validation etc. here in the future
}
