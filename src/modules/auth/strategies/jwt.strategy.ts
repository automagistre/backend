import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { passportJwtSecret } from 'jwks-rsa';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { JwtPayload } from '../dto/jwt.payload';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly configService: ConfigService) {
    const isKeycloakEnabled = configService.get<boolean>(
      'auth.keycloak.enabled',
    );
    const jwksUri = configService.get<string>('auth.keycloak.jwksUri');

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      // We will perform audience validation manually in the validate method
      // audience: configService.get<string>('auth.jwt.audience'),
      issuer: configService.get<string>('auth.jwt.issuer'),
      algorithms: ['RS256'],
      secretOrKeyProvider: isKeycloakEnabled
        ? passportJwtSecret({
            cache: true,
            rateLimit: true,
            jwksRequestsPerMinute: 5,
            jwksUri: jwksUri as string,
          })
        : configService.get<string>('auth.jwt.secret'),
    });
  }

  async validate(payload: any): Promise<JwtPayload> {
    const expectedAudience =
      this.configService.get<string>('auth.jwt.audience');
    const tokenAudience = payload.aud;

    // The `aud` claim can be a string or an array of strings.
    // We need to ensure our expected audience is included.
    if (Array.isArray(tokenAudience)) {
      if (!tokenAudience.includes(expectedAudience)) {
        throw new UnauthorizedException('Invalid token audience');
      }
    } else if (tokenAudience !== expectedAudience) {
      throw new UnauthorizedException('Invalid token audience');
    }

    return {
      sub: payload.sub,
      email: payload.email,
    };
  }
}
