import { Args, Mutation, Resolver, ObjectType, Field } from '@nestjs/graphql';
import { AuthService } from './auth.service';
import { LoginDto, RefreshDto, PasswordLoginDto } from './dto/auth.dto';
import { Public } from './decorators/public.decorator';
import { Tokens } from './models/tokens.model';

// We need to define the GraphQL types that correspond to our DTOs.
// In a real app, you might use @nestjs/graphql decorators to auto-generate this.
// For now, let's assume these types are defined in your schema.
// e.g. type Tokens { accessToken: String!, refreshToken: String!, ... }

@Resolver()
export class AuthResolver {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Mutation(() => Tokens)
  async login(@Args('input') loginDto: LoginDto): Promise<Tokens> {
    return this.authService.exchangeCodeForTokens(loginDto.code);
  }

  @Public()
  @Mutation(() => Tokens)
  async passwordLogin(
    @Args('input') passwordLoginDto: PasswordLoginDto,
  ): Promise<Tokens> {
    return this.authService.loginWithPassword(passwordLoginDto);
  }

  @Public()
  @Mutation(() => Tokens)
  async refresh(@Args('input') refreshDto: RefreshDto): Promise<Tokens> {
    return this.authService.refreshTokens(refreshDto.refreshToken);
  }

  @Public()
  @Mutation(() => Boolean)
  async logout(@Args('input') refreshDto: RefreshDto): Promise<boolean> {
    await this.authService.logout(refreshDto.refreshToken);
    return true;
  }
}
