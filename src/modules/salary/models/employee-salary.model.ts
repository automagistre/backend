import { Field, ID, Int, ObjectType } from '@nestjs/graphql';
import { IsBoolean, IsInt, IsUUID, Max, Min } from 'class-validator';

@ObjectType()
export class EmployeeSalaryModel {
  @IsUUID()
  @Field(() => ID)
  id: string;

  @IsUUID()
  @Field(() => ID)
  employeeId: string;

  @IsInt()
  @Min(1)
  @Max(31)
  @Field(() => Int, { description: 'День месяца начисления (1-31)' })
  payday: number;

  @Min(0)
  @Field(() => BigInt, { description: 'Сумма в минорных единицах (копейки)' })
  amount: bigint;

  @Field(() => Date, { nullable: true })
  createdAt: Date | null;

  @IsBoolean()
  @Field({ description: 'Отменено (есть запись в EmployeeSalaryEnd)' })
  isCancelled: boolean;
}
