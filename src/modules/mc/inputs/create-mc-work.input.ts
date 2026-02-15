import { Field, InputType } from '@nestjs/graphql';
import { IsOptional, IsString, MaxLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { MoneyInput } from 'src/common/inputs/money.input';

@InputType()
export class CreateMcWorkInput {
  @IsString()
  @MaxLength(255)
  @Field(() => String, { description: 'Название работы' })
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  @Field(() => String, { nullable: true })
  description?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  @Field(() => String, { nullable: true })
  comment?: string | null;

  @IsOptional()
  @ValidateNested()
  @Type(() => MoneyInput)
  @Field(() => MoneyInput, {
    nullable: true,
    description: 'Цена работы (минорные единицы и валюта)',
  })
  price?: MoneyInput | null;
}
