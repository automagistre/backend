import { Field, ID, InputType } from '@nestjs/graphql';
import { IsOptional, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ShiftPatternInput } from 'src/modules/shift/inputs/shift-pattern.input';

@InputType({ description: 'Должность сотрудника и её цикл графика' })
export class EmployeePositionInput {
  @Field(() => ID, { description: 'ID должности' })
  positionId: string;

  /**
   * null — снять цикл этой должности; не передавать — не менять.
   */
  @IsOptional()
  @ValidateNested()
  @Type(() => ShiftPatternInput)
  @Field(() => ShiftPatternInput, {
    nullable: true,
    description: 'Цикл графика (null — снять; не передавать — не менять)',
  })
  shift?: ShiftPatternInput | null;
}
