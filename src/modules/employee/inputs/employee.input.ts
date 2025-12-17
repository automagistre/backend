import { Field, ID, InputType, Int, PartialType } from '@nestjs/graphql';
import { IsInt, Min, Max } from 'class-validator';

@InputType()
export class CreateEmployeeInput {
  @Field(() => String, { description: 'ID персоны' })
  personId: string;

  @IsInt()
  @Min(0)
  @Max(100)
  @Field(() => Int, { description: 'Коэффициент (процент от работ)', defaultValue: 100 })
  ratio: number;

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
  @Field(() => Int, { nullable: true, description: 'Коэффициент (процент от работ)' })
  ratio?: number;

  @Field(() => Date, { nullable: true, description: 'Дата найма' })
  hiredAt?: Date;
}

