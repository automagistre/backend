import { Field, ID, InputType, Int } from '@nestjs/graphql';
import { IsInt, IsUUID, Max, Min } from 'class-validator';
import { MoneyInput } from 'src/common/inputs/money.input';

@InputType()
export class CreateEmployeeSalaryInput {
  @Field(() => ID, { description: 'ID сотрудника' })
  @IsUUID()
  employeeId: string;

  @Field(() => Int, { description: 'День месяца начисления (1-31)' })
  @IsInt()
  @Min(1)
  @Max(31)
  payday: number;

  @Field(() => MoneyInput, { description: 'Сумма в минорных единицах (копейки)' })
  amount: MoneyInput;
}
