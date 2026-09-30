import { Field, ID, InputType } from '@nestjs/graphql';
import { IsEnum, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { MoneyInput } from 'src/common/inputs/money.input';
import { CustomerTransactionSource } from '../enums/customer-transaction-source.enum';

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
    description: 'ID счёта. Если не указан — проводка без счёта.',
  })
  walletId?: string | null;

  @IsOptional()
  @IsEnum(CustomerTransactionSource)
  @Field(() => CustomerTransactionSource, {
    nullable: true,
    description:
      'Источник проводки. Payroll — выдача зарплаты (нужен walletId). Без счёта: Penalty — штраф, Bonus — премия (> 0), PieceworkCorrection — корректировка сдельной. Иначе Manual/ManualWithoutWallet.',
  })
  source?: CustomerTransactionSource | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  @Field(() => String, { nullable: true })
  description?: string | null;
}
