import { ObjectType, Field, Int } from '@nestjs/graphql';
import { IsDate, IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';

@ObjectType()
export class AppealModel {
  @IsUUID()
  @Field()
  id: string;

  @IsString()
  @Field()
  name: string;

  @IsInt()
  @Min(1)
  @Field(() => Int)
  type: number;

  @IsOptional()
  @IsString()
  @Field(() => String, { nullable: true })
  phone?: string | null;

  @IsOptional()
  @IsString()
  @Field(() => String, { nullable: true })
  email?: string | null;

  @IsInt()
  @Min(1)
  @Field(() => Int)
  status: number;

  @IsDate()
  @Field()
  createdAt: Date;

  @IsOptional()
  @IsString()
  @Field(() => String, { nullable: true })
  personFullName?: string | null;
}
