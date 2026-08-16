import { Field, ID, InputType, Int } from '@nestjs/graphql';
import { IsInt, IsOptional, Min, Max, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { MoneyInput } from 'src/common/inputs/money.input';

@InputType()
export class CreateEmployeeInput {
  @Field(() => String, { description: 'ID персоны' })
  personId: string;

  @IsInt()
  @Min(0)
  @Max(100)
  @Field(() => Int, {
    description: 'Коэффициент (процент от работ)',
    defaultValue: 100,
  })
  ratio: number;

  @IsOptional()
  @ValidateNested()
  @Type(() => MoneyInput)
  @Field(() => MoneyInput, {
    nullable: true,
    description: 'Гарантированный минимум в месяц',
  })
  guaranteedMinimumAmount?: MoneyInput | null;

  @Field(() => Date, { nullable: true, description: 'Дата найма' })
  hiredAt?: Date;
}

@InputType()
export class UpdateEmployeeInput {
  @Field(() => ID, { description: 'ID сотрудника' })
  id: string;

  @IsInt()
  @Min(0)
  @Max(100)
  @Field(() => Int, {
    nullable: true,
    description: 'Коэффициент (процент от работ)',
  })
  ratio?: number;

  /**
   * null — снять гарантированный минимум; undefined — не менять.
   */
  @IsOptional()
  @ValidateNested()
  @Type(() => MoneyInput)
  @Field(() => MoneyInput, {
    nullable: true,
    description:
      'Гарантированный минимум в месяц (null — снять; не передавать — не менять)',
  })
  guaranteedMinimumAmount?: MoneyInput | null;

  @Field(() => Date, { nullable: true, description: 'Дата найма' })
  hiredAt?: Date;
}
