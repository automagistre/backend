import { Field, InputType, Int } from '@nestjs/graphql';
import { IsUUID } from 'class-validator';

@InputType()
export class CreatePartSupplyInput {
  @IsUUID()
  @Field(() => String)
  partId: string;

  @IsUUID()
  @Field(() => String)
  supplierId: string;

  @Field(() => Int)
  quantity: number;
}
