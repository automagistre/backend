import { Field, ID, InputType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { IsOptional, IsString, IsUUID, MaxLength, ValidateNested } from 'class-validator';
import { MoneyInput } from 'src/common/inputs/money.input';

@InputType()
export class CreateExpenseTransactionInput {
  @IsUUID()
  @Field(() => ID, { description: 'ID статьи расходов' })
  expenseId: string;

  @IsUUID()
  @Field(() => ID, { description: 'ID счёта списания' })
  walletId: string;

  @ValidateNested()
  @Type(() => MoneyInput)
  @Field(() => MoneyInput, { description: 'Сумма (положительная, будет сохранена как списание)' })
  amount: MoneyInput;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  @Field(() => String, {
    nullable: true,
    description: 'Комментарий',
  })
  description?: string | null;
}
