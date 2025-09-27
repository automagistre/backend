import { ObjectType, Field } from '@nestjs/graphql';

@ObjectType()
export class Tokens {
  @Field()
  accessToken: string;

  @Field()
  refreshToken: string;

  @Field(() => Number)
  expiresIn: number;

  @Field(() => Number)
  refreshExpiresIn: number;
} 
