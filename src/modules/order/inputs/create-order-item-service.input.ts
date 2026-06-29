import { Field, ID, InputType } from '@nestjs/graphql';
import { IsOptional } from 'class-validator';
import { MoneyInput } from 'src/common/inputs/money.input';
import { ExecutorInput } from 'src/common/party';

@InputType()
export class CreateOrderItemServiceInput {
  @Field(() => ID)
  orderId: string;

  @Field(() => ID, { nullable: true })
  parentId?: string;

  @Field(() => ID, { nullable: true })
  tenantId?: string;

  @Field(() => String)
  service: string;

  @Field(() => ExecutorInput, { nullable: true })
  @IsOptional()
  executor?: ExecutorInput | null;

  @Field(() => Boolean, { defaultValue: false, nullable: true })
  warranty?: boolean;

  @Field(() => MoneyInput, { nullable: true })
  @IsOptional()
  price?: MoneyInput | null;

  @Field(() => MoneyInput, { nullable: true })
  @IsOptional()
  discount?: MoneyInput | null;
}
