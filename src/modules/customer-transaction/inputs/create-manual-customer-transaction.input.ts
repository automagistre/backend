import { Field, ID, InputType } from '@nestjs/graphql';
import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { MoneyInput } from 'src/common/inputs/money.input';

@InputType()
export class CreateManualCustomerTransactionInput {
  @IsUUID()
  @Field(() => ID, { description: 'ID операнда (Person или Organization)' })
  operandId: string;

  @Field(() => MoneyInput, {
    description:
      'Сумма в минорных единицах (копейки). Положительная — начисление, отрицательная — списание.',
  })
  amount: MoneyInput;

  @IsOptional()
  @IsUUID()
  @Field(() => ID, {
    nullable: true,
    description:
      'ID счёта. Если не указан — проводка без счёта.',
  })
  walletId?: string | null;

  @IsOptional()
  @Field(() => Number, {
    nullable: true,
    description:
      'Источник проводки при отсутствии счёта. Штраф — только если явно передано 9. Иначе ManualWithoutWallet (11).',
  })
  source?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  @Field(() => String, { nullable: true })
  description?: string | null;
}
