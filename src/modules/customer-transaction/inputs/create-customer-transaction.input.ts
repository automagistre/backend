import { Field, ID, InputType, Int } from '@nestjs/graphql';
import {
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { MoneyInput } from 'src/common/inputs/money.input';

/** Внутренний инпут для создания проводки (при закрытии заказа и т.д.). */
@InputType()
export class CreateCustomerTransactionInput {
  @IsUUID()
  @Field(() => ID, { description: 'ID операнда (Person или Organization)' })
  operandId: string;

  @IsInt()
  @Field(() => Int, { description: 'Источник проводки (enum)' })
  source: number;

  @IsUUID()
  @Field(() => String, { description: 'ID источника' })
  sourceId: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  @Field(() => String, { nullable: true })
  description?: string | null;

  @IsOptional()
  @Field(() => MoneyInput, { nullable: true })
  amount?: MoneyInput | null;
}
