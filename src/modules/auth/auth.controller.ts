import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
import {
  LoginDto,
  RefreshDto,
  TokensDto,
  PasswordLoginDto,
} from './dto/auth.dto';
import { Public } from './decorators/public.decorator';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() loginDto: LoginDto): Promise<TokensDto> {
    return this.authService.exchangeCodeForTokens(
      loginDto.code,
      loginDto.redirectUri,
    );
  }

  @Public()
  @Post('password-login')
  @HttpCode(HttpStatus.OK)
  passwordLogin(
    @Body() passwordLoginDto: PasswordLoginDto,
  ): Promise<TokensDto> {
    return this.authService.loginWithPassword(passwordLoginDto);
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  refresh(@Body() refreshDto: RefreshDto): Promise<TokensDto> {
    return this.authService.refreshTokens(refreshDto.refreshToken);
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  logout(@Body() refreshDto: RefreshDto): Promise<void> {
    return this.authService.logout(refreshDto.refreshToken);
  }
}
