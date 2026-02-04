import { Field, ID, Int, ObjectType } from '@nestjs/graphql';
import {
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  MaxLength,
} from 'class-validator';
import { CustomerTransaction } from 'src/generated/prisma/client';

@ObjectType({ description: 'Проводка по клиенту (операнду)' })
export class CustomerTransactionModel implements CustomerTransaction {
  @Field(() => ID)
  id: string;

  @Field(() => String, { description: 'ID заказчика (Person или Organization)' })
  operandId: string;

  @IsInt()
  @Field(() => Int, { description: 'Источник проводки (enum)' })
  source: number;

  @IsUUID()
  @Field(() => String, { description: 'ID источника (заказ, счет и т.д.)' })
  sourceId: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  @Field(() => String, { nullable: true })
  description: string | null;

  @Field(() => String)
  tenantId: string;

  @IsOptional()
  @Field(() => BigInt, {
    nullable: true,
    description: 'Сумма в минорных единицах (копейки)',
  })
  amountAmount: bigint | null;

  @IsOptional()
  @IsString()
  @Length(3, 3)
  @Field(() => String, { nullable: true })
  amountCurrencyCode: string | null;

  @IsOptional()
  @Field(() => Date, { nullable: true })
  createdAt: Date | null;

  createdBy: string | null;

  /** Контекстная строка для отображения (номер заказа, название счёта и т.д.). */
  @Field(() => String, {
    description: 'Строка объекта для отображения. Фронт склеивает с меткой типа.',
  })
  sourceDisplay?: string;
}
