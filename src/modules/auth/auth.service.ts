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

  async exchangeCodeForTokens(code: string): Promise<TokensDto> {
    const params = new URLSearchParams();
    params.append('grant_type', 'authorization_code');
    params.append('client_id', this.configService.get<string>('auth.keycloak.clientId') as string);
    params.append('client_secret', this.configService.get<string>('auth.keycloak.clientSecret') as string);
    params.append('code', code);
    params.append('redirect_uri', this.configService.get<string>('auth.keycloak.redirectUri') as string);

    return this.fetchTokens(params);
  }

  async refreshTokens(refreshToken: string): Promise<TokensDto> {
    const params = new URLSearchParams();
    params.append('grant_type', 'refresh_token');
    params.append('client_id', this.configService.get<string>('auth.keycloak.clientId') as string);
    params.append('client_secret', this.configService.get<string>('auth.keycloak.clientSecret') as string);
    params.append('refresh_token', refreshToken);

    return this.fetchTokens(params);
  }

  async logout(refreshToken: string): Promise<void> {
    const params = new URLSearchParams();
    params.append('client_id', this.configService.get<string>('auth.keycloak.clientId') as string);
    params.append('client_secret', this.configService.get<string>('auth.keycloak.clientSecret') as string);
    params.append('refresh_token', refreshToken);

    try {
      await fetch(this.configService.get<string>('auth.keycloak.logoutEndpoint') as string, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params,
      });
    } catch (error) {
      // It's okay if logout fails, we just log it. The user session is terminated on the client anyway.
      console.error('Keycloak logout failed', error);
    }
  }

  private async fetchTokens(params: URLSearchParams): Promise<TokensDto> {
    const tokenEndpoint = this.configService.get<string>('auth.keycloak.tokenEndpoint') as string;
    try {
      const response = await fetch(tokenEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params,
      });

      if (!response.ok) {
        // If the response is not JSON, we'll get the text and log it.
        const errorBody = await response.text();
        console.error(`Keycloak token endpoint returned an error (URL: ${tokenEndpoint})`);
        console.error(`Response Status: ${response.status} ${response.statusText}`);
        console.error("Response Body:", errorBody);
        
        // Try to parse as JSON in case it's a structured error, otherwise use the raw text.
        try {
          const errorJson = JSON.parse(errorBody);
          throw new UnauthorizedException(errorJson.error_description || 'Keycloak authentication failed');
        } catch (e) {
          throw new UnauthorizedException(`Keycloak returned a non-JSON error page. Status: ${response.status}. Check server logs.`);
        }
      }

      const data = await response.json();
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
      console.error("Network or other error communicating with Keycloak:", error);
      throw new UnauthorizedException('Failed to communicate with authentication provider. Check server logs for details.');
    }
  }

  /**
   * Generates a JWT access token for the given payload.
   * This can be used for password-based login or for refresh token logic.
   */
  async generateAccessToken(payload: JwtPayload): Promise<string> {
    const accessTokenTtl = this.configService.get<number>('auth.jwt.accessTokenTtl');
    return this.jwtService.sign(payload, {
      secret: this.configService.get<string>('auth.jwt.secret'),
      expiresIn: accessTokenTtl ? `${accessTokenTtl}s` : undefined,
    });
  }

  async loginWithPassword(dto: PasswordLoginDto): Promise<TokensDto> {
    const params = new URLSearchParams();
    params.append('grant_type', 'password');
    params.append('client_id', this.configService.get<string>('auth.keycloak.clientId') as string);
    params.append('client_secret', this.configService.get<string>('auth.keycloak.clientSecret') as string);
    params.append('username', dto.username);
    params.append('password', dto.password);

    return this.fetchTokens(params);
  }

  // Add methods for refresh tokens, password validation etc. here in the future
} 
