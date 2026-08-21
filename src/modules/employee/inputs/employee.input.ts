import { Field, ID, InputType, Int } from '@nestjs/graphql';
import { IsInt, IsOptional, Min, Max, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { MoneyInput } from 'src/common/inputs/money.input';

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
}
