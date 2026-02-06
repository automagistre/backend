import { Field, ID, Int, InputType } from '@nestjs/graphql';
import { IsOptional } from 'class-validator';
import { MoneyInput } from 'src/common/inputs/money.input';

@InputType()
export class CreateOrderItemPartInput {
  @Field(() => ID)
  orderId: string;

  @Field(() => ID, { nullable: true })
  parentId?: string;

  @Field(() => ID, { nullable: true })
  tenantId?: string;

  @Field(() => ID)
  partId: string;

  @Field(() => ID, { nullable: true })
  supplierId?: string;

  @Field(() => Int)
  quantity: number;

  @Field(() => Boolean, { defaultValue: false, nullable: true })
  warranty?: boolean;

  @Field(() => MoneyInput, { nullable: true })
  @IsOptional()
  price?: MoneyInput | null;

  @Field(() => MoneyInput, { nullable: true })
  @IsOptional()
  discount?: MoneyInput | null;
}
