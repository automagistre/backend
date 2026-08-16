import { Field, ID, InputType } from '@nestjs/graphql';
import {
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { MoneyInput } from 'src/common/inputs/money.input';
import { CustomerTransactionSource } from '../enums/customer-transaction-source.enum';

/** Внутренний инпут для создания проводки (при закрытии заказа и т.д.). */
@InputType()
export class CreateCustomerTransactionInput {
  @IsUUID()
  @Field(() => ID, { description: 'ID операнда (Person или Organization)' })
  operandId: string;

  @IsEnum(CustomerTransactionSource)
  @Field(() => CustomerTransactionSource, { description: 'Источник проводки' })
  source: CustomerTransactionSource;

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
