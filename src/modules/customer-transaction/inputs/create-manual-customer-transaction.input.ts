import { Field, ID, InputType } from '@nestjs/graphql';
import {
  IsOptional,
  IsString,
  IsUUID,
  Length,
  MaxLength,
} from 'class-validator';

@InputType()
export class CreateManualCustomerTransactionInput {
  @IsUUID()
  @Field(() => ID, { description: 'ID операнда (Person или Organization)' })
  operandId: string;

  /** Сумма в минорных единицах (копейки). Положительная — начисление, отрицательная — списание. */
  @Field(() => BigInt, {
    description: 'Сумма в копейках. Положительная — начисление, отрицательная — списание.',
  })
  amountAmount: bigint;

  @IsOptional()
  @IsString()
  @Length(3, 3)
  @Field(() => String, { nullable: true, defaultValue: 'RUB' })
  amountCurrencyCode?: string | null;

  @IsOptional()
  @IsUUID()
  @Field(() => ID, {
    nullable: true,
    description: 'ID счёта. Если не указан — проводка без счёта (ManualWithoutWallet).',
  })
  walletId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  @Field(() => String, { nullable: true })
  description?: string | null;
}
