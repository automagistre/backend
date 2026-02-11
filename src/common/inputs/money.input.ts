import { Field, InputType } from '@nestjs/graphql';
import { IsOptional, IsString, Length } from 'class-validator';

@InputType({ description: 'Денежная сумма: минорные единицы и код валюты' })
export class MoneyInput {
  @Field(() => BigInt, {
    description: 'Сумма в минорных единицах (копейки)',
  })
  amountMinor: bigint;

  @IsOptional()
  @IsString()
  @Length(3, 3)
  @Field(() => String, {
    nullable: true,
    description: 'Код валюты (например RUB). Если не указан — используется валюта по умолчанию.',
  })
  currencyCode?: string | null;
}
