import { Field, ID, Int, ObjectType } from '@nestjs/graphql';
import {
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  MaxLength,
} from 'class-validator';
import { WalletTransaction } from 'src/generated/prisma/client';
import { WalletModel } from './wallet.model';

@ObjectType({ description: 'Проводка по кошельку' })
export class WalletTransactionModel implements WalletTransaction {
  @IsUUID()
  @Field(() => ID)
  id: string;

  @IsUUID()
  @Field(() => String)
  walletId: string;

  @Field(() => WalletModel, { nullable: true })
  wallet?: WalletModel | null;

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
  description: string | null;

  /** Контекстная строка для отображения (номер заказа, ФИО). Формируется на бекенде. */
  @Field(() => String, {
    description: 'Строка объекта: номер заказа/ФИО и т.д. Фронт склеивает с меткой типа.',
  })
  sourceDisplay?: string;

  @IsUUID()
  @Field(() => String)
  tenantId: string;

  @IsOptional()
  @Field(() => BigInt, { nullable: true, description: 'Сумма в минорных единицах (копейки)' })
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
}
