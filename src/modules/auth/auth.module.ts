import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { JwtStrategy } from './strategies/jwt.strategy';
import { AuthController } from './auth.controller';
import { AuthResolver } from './auth.resolver';
import { MeResolver } from './me.resolver';
import { TokenIntrospectionStrategy } from './strategies/token-introspection.strategy';

@Module({
  imports: [
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => {
        const accessTokenTtl = configService.get<number>(
          'auth.jwt.accessTokenTtl',
        );
        return {
          secret: configService.get<string>('auth.jwt.secret'),
          signOptions: {
            expiresIn: accessTokenTtl ? `${accessTokenTtl}s` : undefined,
          },
        };
      },
    }),
    ConfigModule,
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtAuthGuard,
    AuthResolver,
    MeResolver,
    JwtStrategy,
    TokenIntrospectionStrategy,
  ],
  exports: [AuthService, JwtAuthGuard],
})
export class AuthModule {}
