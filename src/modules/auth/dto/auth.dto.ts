import { IsNotEmpty, IsString } from 'class-validator';
import { InputType, Field } from '@nestjs/graphql';

@InputType()
export class LoginDto {
  @Field()
  @IsString()
  @IsNotEmpty()
  code: string;
}

@InputType()
export class RefreshDto {
  @Field()
  @IsString()
  @IsNotEmpty()
  refreshToken: string;
}

@InputType()
export class PasswordLoginDto {
  @Field()
  @IsString()
  @IsNotEmpty()
  username: string;

  @Field()
  @IsString()
  @IsNotEmpty()
  password: string;
}

export class TokensDto {
  @IsString()
  accessToken: string;

  @IsString()
  refreshToken: string;

  @IsString()
  expiresIn: number;

  @IsString()
  refreshExpiresIn: number;
}
