import { Field, ID, InputType, Int } from '@nestjs/graphql';
import { IsInt, IsOptional, Min, Max, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { MoneyInput } from 'src/common/inputs/money.input';
import { ShiftPatternInput } from 'src/modules/shift/inputs/shift-pattern.input';
import { EmployeePositionInput } from './employee-position.input';

@InputType()
export class CreateEmployeeInput {
  @Field(() => String, { description: 'ID персоны' })
  personId: string;

  /**
   * Без значения по умолчанию: молчаливые 100% отдают исполнителю всю стоимость работы.
   */
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  @Field(() => Int, {
    nullable: true,
    description:
      'Коэффициент (процент от работ). Не передавать — процент не начисляется',
  })
  ratio?: number | null;

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

  @IsOptional()
  @Field(() => [ID], { nullable: true, description: 'Должности сотрудника' })
  positionIds?: string[];

  @IsOptional()
  @ValidateNested()
  @Type(() => ShiftPatternInput)
  @Field(() => ShiftPatternInput, {
    nullable: true,
    description: 'Цикл графика. Не передавать — сотрудник выходит по отметкам',
  })
  shift?: ShiftPatternInput | null;

  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => EmployeePositionInput)
  @Field(() => [EmployeePositionInput], {
    nullable: true,
    description: 'Должности с циклами. Вместо positionIds и shift',
  })
  positions?: EmployeePositionInput[] | null;
}

@InputType()
export class UpdateEmployeeInput {
  @Field(() => ID, { description: 'ID сотрудника' })
  id: string;

  /**
   * null — снять процент; не передавать — не менять.
   */
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  @Field(() => Int, {
    nullable: true,
    description: 'Коэффициент (процент от работ; null — снять)',
  })
  ratio?: number | null;

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

  /**
   * Полный набор должностей: чего нет в списке — снимается. Не передавать — не менять.
   */
  @IsOptional()
  @Field(() => [ID], {
    nullable: true,
    description: 'Должности сотрудника (полный набор)',
  })
  positionIds?: string[];

  /**
   * null — снять цикл, сотрудник останется работать только по отметкам;
   * не передавать — не менять.
   */
  @IsOptional()
  @ValidateNested()
  @Type(() => ShiftPatternInput)
  @Field(() => ShiftPatternInput, {
    nullable: true,
    description: 'Цикл графика (null — снять; не передавать — не менять)',
  })
  shift?: ShiftPatternInput | null;

  /**
   * Полный набор должностей, как positionIds; цикл меняется только там, где передан.
   */
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => EmployeePositionInput)
  @Field(() => [EmployeePositionInput], {
    nullable: true,
    description:
      'Должности с циклами (полный набор). Вместо positionIds и shift',
  })
  positions?: EmployeePositionInput[] | null;
}
