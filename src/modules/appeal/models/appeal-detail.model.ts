import { ObjectType, Field, Int } from '@nestjs/graphql';
import { IsDate, IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';
import GraphQLJSON from 'graphql-type-json';

@ObjectType()
export class AppealDetailModel {
  @IsUUID()
  @Field()
  id: string;

  @IsInt()
  @Min(1)
  @Field(() => Int)
  type: number;

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
  name?: string | null;

  @IsOptional()
  @IsString()
  @Field(() => String, { nullable: true })
  phone?: string | null;

  @IsOptional()
  @IsString()
  @Field(() => String, { nullable: true })
  email?: string | null;

  @IsOptional()
  @IsString()
  @Field(() => String, { nullable: true })
  question?: string | null;

  @IsOptional()
  @IsString()
  @Field(() => String, { nullable: true })
  note?: string | null;

  @IsOptional()
  @IsDate()
  @Field(() => Date, { nullable: true })
  date?: Date | null;

  @IsOptional()
  @IsUUID()
  @Field(() => String, { nullable: true })
  equipmentId?: string | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Field(() => Int, { nullable: true })
  mileage?: number | null;

  @IsOptional()
  @Field(() => BigInt, { nullable: true })
  total?: bigint | null;

  @IsOptional()
  @Field(() => GraphQLJSON, { nullable: true })
  works?: unknown;

  @IsOptional()
  @IsUUID()
  @Field(() => String, { nullable: true })
  modelId?: string | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Field(() => Int, { nullable: true })
  category?: number | null;

  @IsOptional()
  @IsInt()
  @Min(13)
  @Max(24)
  @Field(() => Int, { nullable: true })
  diameter?: number | null;
}
