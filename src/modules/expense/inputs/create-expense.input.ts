import { Field, ID, InputType } from '@nestjs/graphql';
import { IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

@InputType()
export class CreateExpenseInput {
  @IsString()
  @MinLength(3)
  @MaxLength(255)
  @Field(() => String, { description: 'Название статьи расходов' })
  name: string;

  @IsOptional()
  @IsUUID()
  @Field(() => ID, { nullable: true, description: 'ID счёта списания по умолчанию' })
  walletId?: string | null;
}
