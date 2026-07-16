import { Field, ID, InputType, Int } from '@nestjs/graphql';
import { IsDate, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';
import { MoneyInput } from 'src/common/inputs/money.input';
import { TireSeason } from '../enums/tire-season.enum';

@InputType()
export class CreateTireStorageInput {
  @IsUUID()
  @Field(() => ID)
  customerId: string;

  @IsOptional()
  @IsUUID()
  @Field(() => ID, { nullable: true })
  carId?: string | null;

  @IsOptional()
  @IsUUID()
  @Field(() => ID, {
    nullable: true,
    description:
      'Заказ, в котором вводится договор (ENTERED). Пусто — ручное добавление на склад (IN_WAREHOUSE)',
  })
  orderId?: string | null;

  @IsOptional()
  @Field(() => MoneyInput, {
    nullable: true,
    description: 'Сумма договора хранения',
  })
  amount?: MoneyInput | null;

  @IsInt()
  @Min(100)
  @Max(400)
  @Field(() => Int)
  width: number;

  @IsInt()
  @Min(20)
  @Max(100)
  @Field(() => Int)
  height: number;

  @IsInt()
  @Min(10)
  @Max(30)
  @Field(() => Int)
  radius: number;

  @Field(() => String)
  manufacturer: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(12)
  @Field(() => Int, { nullable: true, defaultValue: 4 })
  quantity?: number;

  @Field(() => Boolean, { defaultValue: false })
  onDisks: boolean;

  @Field(() => TireSeason)
  season: TireSeason;

  @IsOptional()
  @IsDate()
  @Field(() => Date, {
    nullable: true,
    description:
      'Дата приёмки (только для ручного добавления). Пусто — текущая дата',
  })
  acceptedAt?: Date | null;

  @IsOptional()
  @Field(() => String, { nullable: true })
  note?: string | null;
}
