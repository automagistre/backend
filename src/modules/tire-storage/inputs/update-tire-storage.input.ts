import { Field, ID, InputType, Int } from '@nestjs/graphql';
import { IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';
import { MoneyInput } from 'src/common/inputs/money.input';
import { TireSeason } from '../enums/tire-season.enum';

@InputType()
export class UpdateTireStorageInput {
  @IsUUID()
  @Field(() => ID)
  id: string;

  @IsOptional()
  @IsUUID()
  @Field(() => ID, {
    nullable: true,
    description: 'Клиент (только для ручной описи на складе)',
  })
  customerId?: string | null;

  @IsOptional()
  @IsUUID()
  @Field(() => ID, { nullable: true })
  carId?: string | null;

  @IsOptional()
  @Field(() => MoneyInput, { nullable: true })
  amount?: MoneyInput | null;

  @IsOptional()
  @IsInt()
  @Min(100)
  @Max(400)
  @Field(() => Int, { nullable: true })
  width?: number;

  @IsOptional()
  @IsInt()
  @Min(20)
  @Max(100)
  @Field(() => Int, { nullable: true })
  height?: number;

  @IsOptional()
  @IsInt()
  @Min(10)
  @Max(30)
  @Field(() => Int, { nullable: true })
  radius?: number;

  @IsOptional()
  @Field(() => String, { nullable: true })
  manufacturer?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(12)
  @Field(() => Int, { nullable: true })
  quantity?: number;

  @IsOptional()
  @Field(() => Boolean, { nullable: true })
  onDisks?: boolean;

  @IsOptional()
  @Field(() => TireSeason, { nullable: true })
  season?: TireSeason;

  @IsOptional()
  @Field(() => Date, {
    nullable: true,
    description: 'Дата приёмки (только для ручной описи; пересчитывает срок)',
  })
  acceptedAt?: Date | null;

  @IsOptional()
  @Field(() => String, { nullable: true })
  note?: string | null;
}
